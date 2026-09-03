// sync-ocds
// Oferentes y adjudicaciones desde la API OCDS pública de Mercado Público (sin ticket):
//   lista por mes: /OCDS/listaOCDSAgnoMes/{año}/{mes}/{offset}/{limit}
//   por proceso:   /OCDS/award/{codigo}  (oferentes, adjudicatario, monto)  y  /OCDS/tender/{codigo}
// Dos frentes por pasada: (1) licitaciones recientes de nuestra base ya cerradas, (2) relleno mes a mes
// hacia atrás. Body opcional: { codigos: [...] } para leer procesos concretos.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://api.mercadopublico.cl/APISOCDS/OCDS";
const UA = "FirmaVB/1.0 (+https://www.firmavb.cl)";
const PARALELO = 2;

function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}
// Contadores de la pasada para distinguir "no publicado" (404) de errores/limitación (429, 5xx, timeout).
const http = { ok: 0, no_publicado: 0, errores: 0 };
class ErrorHttp extends Error {}
async function getJson(url: string, intento = 1): Promise<any | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, signal: ctl.signal });
    if (r.status === 404) { http.no_publicado++; return null; }
    if (!r.ok) throw new ErrorHttp(`HTTP ${r.status}`);
    const j = await r.json();
    if (j?.status === 404) { http.no_publicado++; return null; }
    http.ok++;
    return j;
  } catch (e) {
    clearTimeout(t);
    if (intento < 3) { await new Promise((res) => setTimeout(res, 1500 * intento)); return getJson(url, intento + 1); }
    http.errores++;
    throw e instanceof ErrorHttp ? e : new ErrorHttp(String(e));
  } finally { clearTimeout(t); }
}
const nombreCorto = (s: any) => String(s ?? "").split(" | ")[0].trim().slice(0, 200);
function partes(rel: any) {
  const out: { nombre: string; id: string | null; rut: string | null; roles: string[] }[] = [];
  for (const p of rel?.parties ?? []) {
    out.push({ nombre: nombreCorto(p.name), id: p.id ?? null, rut: p.identifier?.scheme === "CL-RUT" ? String(p.identifier.id) : null, roles: p.roles ?? [] });
  }
  return out;
}
// Toma del award y del tender lo que el Experto necesita.
function destilar(codigo: string, award: any, tender: any) {
  const ra = award?.releases?.[0];
  const rts: any[] = tender?.releases ?? [];
  const rt = rts.length ? rts[rts.length - 1] : null;
  const ps = [...partes(ra), ...partes(rt)];
  const comprador = ps.find((p) => p.roles.includes("buyer") || p.roles.includes("procuringEntity"));
  const vistos = new Set<string>();
  const oferentes = ps.filter((p) => p.roles.includes("tenderer") && !vistos.has(p.nombre) && vistos.add(p.nombre)).map((p) => ({ nombre: p.nombre, id: p.id, rut: p.rut }));
  const adjs: any[] = [];
  let monto = 0; let fechaAdj: string | null = null; let estadoAward: string | null = null;
  for (const a of ra?.awards ?? []) {
    estadoAward = a.statusDetails ?? a.status ?? estadoAward;
    fechaAdj = a.date ?? fechaAdj;
    const m = Number(a.value?.amount ?? 0); monto += m;
    for (const s of a.suppliers ?? []) {
      const p = ps.find((x) => x.id === s.id);
      adjs.push({ nombre: nombreCorto(s.name), id: s.id ?? null, rut: p?.rut ?? null, monto: m, items: (a.items ?? []).length });
    }
  }
  const t = rt?.tender ?? null;
  const items = (t?.items ?? ra?.awards?.[0]?.items ?? []).slice(0, 40).map((i: any) => ({ descripcion: String(i.description ?? "").slice(0, 200), cantidad: i.quantity ?? null, unidad: i.unit?.name ?? null, monto: i.unit?.value?.amount ?? null }));
  return {
    codigo, ocid: ra?.ocid ?? rt?.ocid ?? null,
    comprador_nombre: comprador?.nombre ?? nombreCorto(t?.procuringEntity?.name) ?? null,
    comprador_id: comprador?.id ?? t?.procuringEntity?.id ?? null,
    comprador_rut: comprador?.rut ?? null,
    titulo: (t?.title ?? ra?.awards?.[0]?.title ?? null)?.slice(0, 300) ?? null,
    metodo: t?.procurementMethodDetails ?? null,
    estado_tender: t?.statusDetails ?? t?.status ?? null,
    monto_estimado: t?.value?.amount ?? null, moneda: t?.value?.currency ?? ra?.awards?.[0]?.value?.currency ?? null,
    fecha_publicacion: t?.tenderPeriod?.startDate ?? null, fecha_cierre: t?.tenderPeriod?.endDate ?? null,
    num_oferentes: oferentes.length || null, oferentes: oferentes.length ? oferentes : null,
    adjudicatarios: adjs.length ? adjs : null, monto_adjudicado: adjs.length ? monto : null,
    fecha_adjudicacion: fechaAdj, estado_award: estadoAward,
    items: items.length ? items : null,
    tender_leido: !!rt, award_leido: !!ra,
  };
}
// Devuelve undefined cuando hubo error de red/limitación (para no dar el proceso por leído).
async function leerProceso(codigo: string, conTender: boolean) {
  try {
    const [award, tender] = await Promise.all([getJson(`${API}/award/${codigo}`), conTender ? getJson(`${API}/tender/${codigo}`) : Promise.resolve(null)]);
    if (!award && !tender) return null;
    return destilar(codigo, award, tender);
  } catch { return undefined; }
}
async function enLotes<T>(xs: T[], fn: (x: T) => Promise<any>, n: number, limiteMs: number, t0: number) {
  const out: any[] = [];
  for (let i = 0; i < xs.length; i += n) {
    if (Date.now() - t0 > limiteMs) break;
    out.push(...(await Promise.all(xs.slice(i, i + n).map(fn))));
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let body: any = {}; try { body = await req.json(); } catch { /* vacío */ }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const t0 = Date.now();
  http.ok = 0; http.no_publicado = 0; http.errores = 0;
  const res: any = { recientes: 0, mes: null, guardadas: 0, sin_dato: 0, errores: [] };
  const guardar = async (filas: any[]) => {
    const ok = filas.filter(Boolean);
    res.sin_dato += filas.length - ok.length;
    if (!ok.length) return;
    const { data, error } = await sb.rpc("ocds_upsert", { p_filas: ok });
    if (error) res.errores.push(error.message); else res.guardadas += data ?? 0;
  };

  // 0. Códigos explícitos
  if (Array.isArray(body.codigos) && body.codigos.length) {
    const filas = await enLotes(body.codigos.slice(0, 200), (c: string) => leerProceso(c, true), PARALELO, 110_000, t0);
    await guardar(filas);
    res.muestra = filas.filter(Boolean).slice(0, 2);
    return new Response(JSON.stringify({ ...res, ms: Date.now() - t0 }), { headers: { "Content-Type": "application/json" } });
  }

  // 1. Licitaciones recientes de nuestra base, cerradas y sin adjudicación leída
  const { data: pend } = await sb.rpc("ocds_codigos_pendientes", { p_max: Number(body.recientes ?? 80) });
  if (pend?.length) {
    const codigos: string[] = pend.map((r: any) => r.codigo);
    const filas = await enLotes(codigos, (c: string) => leerProceso(c, false), PARALELO, 60_000, t0);
    res.recientes = filas.length;
    // Los que OCDS aún no publica se anotan como leídos (award_leido) para reintentarlos recién en 7 días.
    await guardar(filas.map((f, i) => f === undefined ? undefined : (f ?? { codigo: codigos[i], award_leido: true })));
  }

  // 2. Relleno mes a mes hacia atrás (solo procesos con adjudicación publicada)
  if (Date.now() - t0 < 70_000 && body.relleno !== false) {
    const { data: m } = await sb.rpc("ocds_mes_pendiente");
    const mp = m?.[0];
    if (mp) {
      const limite = Number(body.lote_mes ?? 200);
      const lista = await getJson(`${API}/listaOCDSAgnoMes/${mp.anio}/${mp.mes}/${mp.offset_leido}/${limite}`);
      if (!lista) {
        // La API publica el mes con rezago: se marca total 0 y se reintenta al día siguiente.
        await sb.rpc("ocds_marcar_mes", { p_anio: mp.anio, p_mes: mp.mes, p_offset: 0, p_total: 0, p_completo: false });
        res.mes = { anio: mp.anio, mes: mp.mes, publicado: false };
        return new Response(JSON.stringify({ ...res, ms: Date.now() - t0 }), { headers: { "Content-Type": "application/json" } });
      }
      const datos: any[] = lista?.data ?? [];
      const total = lista?.pagination?.total ?? mp.total ?? 0;
      const conAward = datos.filter((d) => d.urlAward).map((d) => String(d.urlAward).split("/").pop()!);
      const filas = await enLotes(conAward, (c: string) => leerProceso(c, true), PARALELO, 85_000, t0);
      // Los que fallaron por red/limitación o no alcanzaron en el tiempo quedan como fila vacía (sin leído)
      // y se reintentan en el frente 1. El puntero del mes avanza siempre: así un tramo con errores no se repite eternamente.
      const sinTiempo = conAward.slice(filas.length);
      await guardar([...filas.map((f, i) => f === undefined ? { codigo: conAward[i] } : f), ...sinTiempo.map((c) => ({ codigo: c }))]);
      res.reintentar = filas.filter((f) => f === undefined).length + sinTiempo.length;
      const nuevoOffset = mp.offset_leido + datos.length;
      const completo = datos.length < limite || nuevoOffset >= total;
      await sb.rpc("ocds_marcar_mes", { p_anio: mp.anio, p_mes: mp.mes, p_offset: nuevoOffset, p_total: total, p_completo: completo });
      res.mes = { anio: mp.anio, mes: mp.mes, offset: nuevoOffset, total, en_tramo: datos.length, con_award: conAward.length, leidos: filas.length, completo };
    }
  }
  return new Response(JSON.stringify({ ...res, http, ms: Date.now() - t0 }), { headers: { "Content-Type": "application/json" } });
});
