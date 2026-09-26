import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Unzip, UnzipInflate } from "https://esm.sh/fflate@0.8.2";

// Carga el archivo mensual "Transacciones Convenio Marco" de datos abiertos de
// ChileCompra (planillas-cm/[año]-[mes].zip) y guarda, por cada OC, el convenio
// oficial (código, ID y nombre). Ver docs/datos-abiertos-convenio-marco.md.
// Lo llama pg_cron (cargar-cm-convenios) a diario con service role: por defecto
// carga el mes anterior si aún no está cargado (ChileCompra lo publica ~día 11).
// Body opcional: { periodo: 'YYYY-MM', forzar: true }.

const BASE = "https://transparenciachc.blob.core.windows.net/planillas-cm/";
const COLS = { cm: "Nro Licitacion Publica", id: "Id Convenio Marco", nombre: "Convenio Marco", oc: "CodigoOC" } as const;
const LOTE = 1500; // por lote: el RPC debe caber en los 8 s de statement_timeout de PostgREST

interface Convenio { codigo: string; id_cm: string; nombre: string }

// Lector de CSV por bytes (separador ';', comillas dobles, campos multilínea, Latin-1).
// Solo copia los campos cuyo índice está en `necesarios`; el resto se salta sin copiar.
class LectorCsv {
  private dec = new TextDecoder("windows-1252");
  private buf = new Uint8Array(8192);
  private len = 0;
  private enComillas = false;
  private campo = 0;
  private capturar = true;
  private fila: (string | null)[] = [];
  private tuvoCampo = false;
  registros = 0;
  cabecera: string[] | null = null;
  necesarios = new Set<number>();
  onCabecera: (c: string[]) => void = () => {};
  onFila: (f: (string | null)[]) => void = () => {};

  private texto(): string {
    let s = this.dec.decode(this.buf.subarray(0, this.len));
    if (this.cabecera === null && this.campo === 0) s = s.replace(/^(\uFEFF|\u00EF\u00BB\u00BF)/, ""); // BOM
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    return s.replace(/""/g, '"');
  }
  private debeCapturar() { return this.cabecera === null || this.necesarios.has(this.campo); }
  private cerrarCampo() {
    if (this.capturar) this.fila[this.campo] = this.texto();
    this.len = 0; this.campo++; this.tuvoCampo = true; this.capturar = this.debeCapturar();
  }
  private cerrarFila() {
    this.cerrarCampo();
    if (this.cabecera === null) {
      this.cabecera = this.fila.map((c) => (c ?? "").replace(/^\uFEFF/, "").trim());
      this.onCabecera(this.cabecera);
    } else {
      this.registros++;
      this.onFila(this.fila);
    }
    this.fila = []; this.campo = 0; this.tuvoCampo = false; this.capturar = this.debeCapturar();
  }
  push(chunk: Uint8Array) {
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];
      if (b === 0x22) this.enComillas = !this.enComillas;
      else if (!this.enComillas) {
        if (b === 0x3b) { this.cerrarCampo(); continue; }
        if (b === 0x0a) { this.cerrarFila(); continue; }
        if (b === 0x0d) continue;
      }
      if (this.capturar) {
        if (this.len === this.buf.length) { const n = new Uint8Array(this.buf.length * 2); n.set(this.buf); this.buf = n; }
        this.buf[this.len++] = b;
      }
    }
  }
  fin() { if (this.len > 0 || this.tuvoCampo) this.cerrarFila(); }
}

function periodoAnterior(): string {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

serve(async (req: Request) => {
  const inicio = Date.now();
  try {
    const auth = req.headers.get("Authorization") || "";
    let rol = "";
    try { rol = JSON.parse(atob((auth.replace(/^Bearer\s+/i, "").split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))).role || ""; } catch { rol = ""; }
    if (rol !== "service_role") return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });

    const body = await req.json().catch(() => ({}));
    const periodo: string = typeof body.periodo === "string" && /^\d{4}-\d{2}$/.test(body.periodo) ? body.periodo : periodoAnterior();
    const forzar = body.forzar === true;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const json = (o: unknown, status = 200) => new Response(JSON.stringify({ periodo, ...(o as object), ms: Date.now() - inicio }), { status, headers: { "Content-Type": "application/json" } });

    if (!forzar) {
      const { data: previa } = await supabase.from("cm_cargas").select("estado").eq("periodo", periodo).maybeSingle();
      if (previa?.estado === "ok") return json({ ok: true, omitido: "ya cargado" });
    }
    const anotar = (estado: string, extra: Record<string, unknown> = {}) =>
      supabase.from("cm_cargas").upsert({ periodo, estado, cargado_en: new Date().toISOString(), ...extra });

    const [anio, mes] = periodo.split("-");
    const url = `${BASE}${anio}-${Number(mes)}.zip`;
    const resp = await fetch(url);
    if (resp.status === 404) { await anotar("no_publicado", { detalle: url }); return json({ ok: false, motivo: "no_publicado", url }); }
    if (!resp.ok || !resp.body) { await anotar("error", { detalle: `HTTP ${resp.status}` }); return json({ ok: false, motivo: `HTTP ${resp.status}` }, 502); }

    // Descomprimir en streaming y leer el CSV sin cargarlo entero en memoria.
    const lector = new LectorCsv();
    const convenios = new Map<string, Convenio>();
    const ocs = new Map<string, string>();
    let idx: Record<keyof typeof COLS, number> | null = null;
    lector.onCabecera = (cab) => {
      const pos = (n: string) => cab.findIndex((c) => c.toLowerCase() === n.toLowerCase());
      idx = { cm: pos(COLS.cm), id: pos(COLS.id), nombre: pos(COLS.nombre), oc: pos(COLS.oc) };
      for (const [k, v] of Object.entries(idx)) if (v < 0) throw new Error(`columna no encontrada: ${COLS[k as keyof typeof COLS]}`);
      lector.necesarios = new Set(Object.values(idx));
    };
    lector.onFila = (f) => {
      if (!idx) return;
      const cm = (f[idx.cm] || "").trim(), oc = (f[idx.oc] || "").trim();
      if (!cm || cm === "NA" || !oc || oc === "NA") return;
      if (!convenios.has(cm)) convenios.set(cm, { codigo: cm, id_cm: (f[idx.id] || "").trim(), nombre: (f[idx.nombre] || "").trim().slice(0, 300) });
      ocs.set(oc, cm);
    };

    let errorZip: Error | null = null;
    const unz = new Unzip();
    unz.register(UnzipInflate);
    unz.onfile = (archivo) => {
      if (!/\.csv$/i.test(archivo.name)) return;
      archivo.ondata = (err, chunk, final) => {
        if (err) { errorZip = err; return; }
        try { lector.push(chunk); if (final) lector.fin(); } catch (e) { errorZip = e as Error; }
      };
      archivo.start();
    };
    const reader = resp.body.getReader();
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) { unz.push(new Uint8Array(0), true); break; }
      bytes += value.length; unz.push(value, false);
      if (errorZip) break;
    }
    if (errorZip) { await anotar("error", { detalle: String((errorZip as Error).message).slice(0, 300) }); return json({ ok: false, motivo: "zip", detalle: (errorZip as Error).message }, 500); }
    if (!idx) { await anotar("error", { detalle: "csv vacío" }); return json({ ok: false, motivo: "csv_vacio" }, 500); }

    // Guardar en lotes vía RPC (convenios solo en el primero).
    const lista = [...ocs.entries()].map(([oc, cm]) => ({ oc, cm }));
    let actualizadas = 0, guardadas = 0;
    for (let i = 0; i < lista.length; i += LOTE) {
      const { data, error } = await supabase.rpc("cm_cargar_convenios", {
        p_periodo: periodo,
        p_convenios: i === 0 ? [...convenios.values()] : [],
        p_ocs: lista.slice(i, i + LOTE),
      });
      if (error) { await anotar("error", { detalle: error.message.slice(0, 300) }); return json({ ok: false, motivo: "rpc", detalle: error.message }, 500); }
      actualizadas += Number(data?.actualizadas || 0); guardadas += Number(data?.ocs || 0);
    }
    await anotar("ok", { filas: lector.registros, ocs: ocs.size, ocs_actualizadas: actualizadas, detalle: `${convenios.size} convenios, ${bytes} bytes` });
    if (body.refrescar !== false) await supabase.rpc("cm_refrescar_por_convenio");
    return json({ ok: true, filas: lector.registros, convenios: convenios.size, ocs: ocs.size, guardadas, actualizadas, bytes });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, ms: Date.now() - inicio }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
