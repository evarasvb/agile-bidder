// Sondeo de endpoints candidatos para la NUEVA API de Compra Ágil
// Probamos varios paths que podrían ser el endpoint beta lanzado en mayo 2026
Deno.serve(async () => {
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if (!ticket) return new Response(JSON.stringify({ error: 'sin ticket' }), { status: 500 });

  const candidatos = [
    // Variantes lógicas siguiendo la convención existente
    `https://api.mercadopublico.cl/servicios/v1/publico/comprasagiles.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/v1/publico/compraagil.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/v1/publico/compra-agil.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/v1/publico/cotizaciones.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/v1/publico/solicitudescotizacion.json?ticket=${ticket}`,
    // Versión v2 / beta
    `https://api.mercadopublico.cl/servicios/v2/publico/comprasagiles.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/v1/beta/comprasagiles.json?ticket=${ticket}`,
    `https://api.mercadopublico.cl/servicios/beta/comprasagiles.json?ticket=${ticket}`,
    // Buscar por código COT directamente
    `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=1000813-101-COT26&ticket=${ticket}`,
    // Pre-prod
    `https://apipre.mercadopublico.cl/servicios/v1/publico/comprasagiles.json?ticket=${ticket}`,
  ];

  const resultados: any[] = [];

  for (const url of candidatos) {
    const urlSeguro = url.replace(ticket, ticket.slice(0,4) + '...');
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timeout);

      const ct = resp.headers.get('content-type') || '';
      let body: any = null;
      let txt = '';
      try {
        txt = await resp.text();
        if (ct.includes('json')) body = JSON.parse(txt);
      } catch {}

      resultados.push({
        url: urlSeguro,
        status: resp.status,
        content_type: ct,
        codigo_mp: body?.Codigo ?? null,
        mensaje_mp: body?.Mensaje ?? null,
        cantidad: body?.Cantidad ?? null,
        primeros_400: txt.slice(0, 400)
      });
    } catch (e) {
      resultados.push({
        url: urlSeguro,
        error: e instanceof Error ? e.message : String(e)
      });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return new Response(JSON.stringify({ resultados }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
});
