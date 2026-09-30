// RF / Consulta al Mercado (RFI): lo que un organismo público pregunta ANTES
// de licitar (precios, características, plazos). API pública de
// consulta-mercado.mercadopublico.cl, documentada en
// .claude/skills/bajo-el-agua/SKILL.md (fase 3). Sin ticket propio: token
// anónimo de corta duración que se pide en cada corrida.
// Llamado por pg_cron (sync-consultas-mercado-cron) con el JWT legacy, igual
// que evaristo-vigia — ver token_es_service_role_legacy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const AUTH_URL = "https://servicios-prd.mercadopublico.cl/v1/auth/publico";
const API_BASE = "https://servicios-consultas-prd.mercadopublico.cl/v1/consulta-mercado";

function pick(...vals: unknown[]) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return null;
}
function toIso(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function tokenAnonimo(): Promise<string> {
  const r = await fetch(AUTH_URL, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`auth ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const j = await r.json();
  const token = j?.payload?.access_token ?? j?.access_token;
  if (!token) throw new Error(`auth sin access_token: ${JSON.stringify(j).slice(0, 200)}`);
  return token;
}

// Shape real confirmado contra la API en vivo (payload.resultados, campos en
// camelCase: codigoConsulta, nombreInstitucion, rutOrganismo, nombreUsuario,
// estado numérico). Se mantienen alternativas de respaldo por si la API
// cambia el nombre de algún campo.
function filaAConsulta(x: any) {
  const codigo = pick(x.codigoConsulta, x.codigo, x.Codigo, x.numero);
  if (!codigo) return null;
  const estado = pick(x.estado, x.Estado);
  return {
    codigo: String(codigo),
    nombre: pick(x.nombre, x.Nombre, x.titulo, x.asunto),
    descripcion: pick(x.descripcion, x.Descripcion),
    motivo: pick(x.motivo, x.Motivo),
    organismo_nombre: pick(x.nombreInstitucion, x.organismoComprador, x.organismo, x.nombreOrganismo, x.NombreOrganismo),
    organismo_rut: pick(x.rutOrganismo, x.RutOrganismo, x.rutUnidad),
    encargado: pick(x.nombreUsuario, x.encargado, x.responsable),
    estado: estado === null ? null : String(estado),
    fecha_publicacion: toIso(pick(x.fechaPublicacion, x.FechaPublicacion, x.fechaCreacion)),
    fecha_cierre: toIso(pick(x.fechaCierre, x.FechaCierre, x.fechaTermino)),
    raw_data: x,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: autorizado } = await supabase.rpc("token_es_service_role_legacy", { p_token: token });
    if (!token || !autorizado) {
      return new Response(JSON.stringify({ error: "no_autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const dias = Math.min(Number(body.dias) || 45, 120);
    const paginasMax = Math.min(Number(body.paginas) || 5, 20);
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10) + " 00:00:00";
    const hasta = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) + " 23:59:59";

    const mpToken = await tokenAnonimo();

    const urlPagina = (pagina: number) => `${API_BASE}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&pagina=${pagina}`;
    const pedirPagina = async (pagina: number) => {
      const r = await fetch(urlPagina(pagina), { headers: { Authorization: `Bearer ${mpToken}`, Accept: "application/json" } });
      if (!r.ok) throw new Error(`listado pag ${pagina}: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
      return await r.json();
    };

    let total = 0;
    let guardadas = 0;
    let muestra: unknown = null;
    const errores: string[] = [];
    const paginasLeidas: number[] = [];

    // La API ordena de la consulta más antigua a la más nueva (igual que
    // documenta supabase/functions/experto-bajo-agua/index.ts para el mismo
    // endpoint). Se lee la página 1 solo para saber cuántas hay.
    const j1 = await pedirPagina(1);
    const pageCount = Math.max(1, Number(j1?.payload?.pageCount) || 1);

    let paginas: number[];
    let nuevoCursor: number | null = null;
    if (pageCount <= paginasMax) {
      // Cabe todo en una corrida: no hace falta repartir cupo ni tocar el cursor.
      paginas = Array.from({ length: pageCount }, (_, i) => i + 1);
    } else {
      // Reparte el cupo entre "recientes" (siempre las últimas páginas, para
      // no perder nunca lo nuevo) y "backfill" (avanza con un cursor
      // persistente por el resto de la ventana hasta cubrirla completa; el
      // cron cada 15 min hace varias corridas, así que se termina cubriendo).
      const reservadasRecientes = Math.ceil(paginasMax / 2);
      const reservadasBackfill = paginasMax - reservadasRecientes;
      const recientes = Array.from({ length: reservadasRecientes }, (_, i) => pageCount - reservadasRecientes + 1 + i);
      const limiteBackfill = pageCount - reservadasRecientes; // páginas 1..limiteBackfill quedan fuera de "recientes"

      let backfill: number[] = [];
      if (reservadasBackfill > 0 && limiteBackfill >= 1) {
        const { data: estado } = await supabase
          .from("consultas_mercado_sync_estado")
          .select("ultima_pagina_backfill")
          .eq("id", true)
          .maybeSingle();
        // Arranca (y reinicia) en 1, no en 2: la página 1 también tiene RF
        // propias (las más antiguas de la ventana), no es solo metadata.
        let cursor = estado?.ultima_pagina_backfill ?? 1;
        if (cursor > limiteBackfill) cursor = 1; // ya se cubrió toda la ventana: vuelve a empezar
        const fin = Math.min(cursor + reservadasBackfill - 1, limiteBackfill);
        backfill = Array.from({ length: fin - cursor + 1 }, (_, i) => cursor + i);
        nuevoCursor = fin >= limiteBackfill ? 1 : fin + 1;
      }
      paginas = [...recientes, ...backfill];
    }

    for (const pagina of paginas) {
      let j: any;
      try {
        j = pagina === 1 ? j1 : await pedirPagina(pagina);
      } catch (e) {
        errores.push(e instanceof Error ? e.message : String(e));
        continue;
      }
      const listado: any[] = j?.payload?.resultados ?? j?.payload?.listado ?? j?.listado ?? j?.data ?? (Array.isArray(j) ? j : []);
      if (!muestra && listado[0]) muestra = listado[0];
      if (!listado.length) continue;
      total += listado.length;
      paginasLeidas.push(pagina);

      const filas = listado.map(filaAConsulta).filter((f): f is NonNullable<typeof f> => f !== null);
      if (filas.length) {
        const { error, count } = await supabase.from("consultas_mercado").upsert(filas, { onConflict: "codigo", count: "exact" });
        if (error) errores.push(`upsert pag ${pagina}: ${error.message}`);
        else guardadas += count ?? filas.length;
      }
    }

    if (nuevoCursor !== null) {
      const { error } = await supabase
        .from("consultas_mercado_sync_estado")
        .update({ ultima_pagina_backfill: nuevoCursor, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) errores.push(`cursor backfill: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: errores.length === 0, dias, desde, hasta, page_count: pageCount, paginas_leidas: paginasLeidas, backfill_cursor_siguiente: nuevoCursor, total_listado: total, guardadas, errores, muestra, ms: Date.now() - t0 }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }), { status: 500, headers: cors });
  }
});
