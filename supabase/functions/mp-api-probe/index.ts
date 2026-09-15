// PRUEBA (no producción): ¿la API oficial con ticket de Mercado Público
// (api.mercadopublico.cl/servicios/v1/publico/licitaciones.json) trae los
// adjuntos/bases de una licitación? Es la API documentada que usan los
// integradores; distinta de la OCDS. Usa el ticket MERCADOPUBLICO_API_KEY.
//   GET ?codigo=1234-56-LE26
const API = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
Deno.serve(async (req) => {
  try {
    const codigo = new URL(req.url).searchParams.get("codigo") || "";
    if (!codigo) return new Response(JSON.stringify({ error: "falta codigo" }), { status: 400 });
    const ticket = Deno.env.get("MERCADOPUBLICO_API_KEY") || "";
    if (!ticket) return new Response(JSON.stringify({ error: "sin_ticket" }), { status: 500 });
    const r = await fetch(`${API}?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`, {
      headers: { "User-Agent": "FirmaVB/1.0 (+https://www.firmavb.cl)", Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    const status = r.status;
    const j = await r.json().catch(() => null);
    const lic = Array.isArray(j?.Listado) ? j.Listado[0] : null;
    // Buscamos cualquier clave que suene a adjunto/documento/base en toda la ficha.
    const clavesTop = lic ? Object.keys(lic) : (j ? Object.keys(j) : null);
    const clavesSospechosas = clavesTop?.filter((k) => /adjunt|document|base|anexo|archivo|file|url/i.test(k)) ?? [];
    return new Response(JSON.stringify({
      codigo, status,
      cantidad_en_listado: Array.isArray(j?.Listado) ? j.Listado.length : null,
      claves_ficha: clavesTop,
      claves_que_suenan_a_adjunto: clavesSospechosas,
      muestra_de_esas_claves: Object.fromEntries((clavesSospechosas).map((k) => [k, lic?.[k]])),
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500 });
  }
});
