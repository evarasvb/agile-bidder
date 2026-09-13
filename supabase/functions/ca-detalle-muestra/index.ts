// Diagnóstico: devuelve el detalle crudo de la API v2 de ChileCompra para uno o
// más códigos de compra ágil, para ver qué campos trae y decidir qué guardar.
Deno.serve(async (req) => {
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if (!ticket) return new Response(JSON.stringify({ error: 'sin ticket' }), { status: 500 });
  let codigos: string[] = [];
  try { const b = await req.json(); codigos = Array.isArray(b?.codigos) ? b.codigos.slice(0, 3) : []; } catch (_) { /* vacío */ }
  const out: Record<string, unknown> = {};
  for (const c of codigos) {
    try {
      const r = await fetch(`https://api2.mercadopublico.cl/v2/compra-agil/${encodeURIComponent(c)}`, { headers: { ticket, Accept: 'application/json' } });
      const txt = await r.text();
      out[c] = { status: r.status, body: txt.slice(0, 9000) };
    } catch (e) { out[c] = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
