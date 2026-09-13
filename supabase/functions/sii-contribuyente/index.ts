// Edge Function: sii-contribuyente
// Consulta la situación tributaria pública de un RUT en el SII vía ApiGateway.cl
// y la guarda en caché (tabla public.sii_contribuyentes) para no gastar créditos
// repitiendo la misma consulta.
//
// Uso:  GET  /functions/v1/sii-contribuyente?rut=76192083-9
//       GET  /functions/v1/sii-contribuyente?rut=76192083-9&refresh=1   (ignora caché)
//
// Secret requerido: APIGATEWAY_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://app.apigateway.cl";
const TOKEN = Deno.env.get("APIGATEWAY_TOKEN") ?? "";
const CACHE_DIAS = 30;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json; charset=utf-8",
};

/** Deja el RUT como 76192083-9 (sin puntos, con guión, DV en mayúscula). */
function normalizaRut(input: string): { rut: string; cuerpo: number; dv: string } | null {
  const limpio = String(input).replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 2) return null;
  const cuerpo = Number(limpio.slice(0, -1));
  const dv = limpio.slice(-1);
  if (!Number.isFinite(cuerpo) || cuerpo <= 0) return null;
  return { rut: `${cuerpo}-${dv}`, cuerpo, dv };
}

/** Valida el dígito verificador (módulo 11) para no gastar créditos en RUTs falsos. */
function dvValido(cuerpo: number, dv: string): boolean {
  let suma = 0, mul = 2;
  for (const c of String(cuerpo).split("").reverse()) {
    suma += Number(c) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return esperado === dv;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!TOKEN) {
      return new Response(JSON.stringify({ error: "Falta el secret APIGATEWAY_TOKEN" }), { status: 500, headers: cors });
    }

    const url = new URL(req.url);
    const rutParam = url.searchParams.get("rut") ?? "";
    const refresh = ["1", "true", "si"].includes((url.searchParams.get("refresh") ?? "").toLowerCase());

    const n = normalizaRut(rutParam);
    if (!n) return new Response(JSON.stringify({ error: "Parámetro 'rut' inválido" }), { status: 400, headers: cors });
    if (!dvValido(n.cuerpo, n.dv)) {
      return new Response(JSON.stringify({ error: `RUT ${n.rut}: dígito verificador incorrecto` }), { status: 400, headers: cors });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Caché
    if (!refresh) {
      const { data: cache } = await db
        .from("sii_contribuyentes")
        .select("*")
        .eq("rut", n.cuerpo)
        .maybeSingle();

      if (cache) {
        const dias = (Date.now() - new Date(cache.actualizado_en).getTime()) / 86_400_000;
        if (dias < CACHE_DIAS) {
          return new Response(JSON.stringify({ origen: "cache", ...cache }), { headers: cors });
        }
      }
    }

    // 2) Consulta al SII vía ApiGateway (el servicio puede tardar ~20 s)
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 40_000);

    const resp = await fetch(
      `${API_BASE}/api/v2/sii/contribuyentes/situacion_tributaria/tercero/${n.rut}`,
      { headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" }, signal: ctrl.signal },
    );
    clearTimeout(t);

    const creditos = resp.headers.get("X-Stats-Credits-Remaining");
    const cuerpoResp = await resp.text();

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "ApiGateway respondió con error", status: resp.status, detalle: cuerpoResp.slice(0, 500) }),
        { status: resp.status === 429 ? 429 : 502, headers: cors },
      );
    }

    const json = JSON.parse(cuerpoResp);
    const d = json.data ?? {};

    const fila = {
      rut: d.rut ?? n.cuerpo,
      dv: d.dv ?? n.dv,
      rut_formateado: `${d.rut ?? n.cuerpo}-${d.dv ?? n.dv}`,
      razon_social: d.razon_social ?? null,
      inicio_actividades: d.inicio_actividades ?? null,
      fecha_inicio_actividades: d.fecha_inicio_actividades ?? null,
      pro_pyme: d.pro_pyme ?? null,
      moneda_extranjera: d.moneda_extranjera ?? null,
      obligacion_dte: d.obligacion_dte ?? null,
      excepcion_dte: d.excepcion_dte ?? null,
      actividades: d.actividades ?? [],
      codigos_actividad: (d.actividades ?? []).map((a: any) => a.codigo),
      documentos_timbrados: d.documentos_timbrados ?? [],
      observaciones: d.observaciones ?? {},
      tiene_observaciones: Object.values(d.observaciones ?? {}).some(Boolean),
      raw: d,
      actualizado_en: new Date().toISOString(),
    };

    await db.from("sii_contribuyentes").upsert(fila, { onConflict: "rut" });

    return new Response(JSON.stringify({ origen: "sii", creditos_restantes: creditos, ...fila }), { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timeout = msg.includes("abort");
    return new Response(JSON.stringify({ error: timeout ? "El SII no respondió a tiempo" : msg }), {
      status: timeout ? 504 : 500,
      headers: cors,
    });
  }
});
