// Diagnóstico desactivado (se usó para descubrir el endpoint de detalle de CA).
Deno.serve(() => new Response(JSON.stringify({ disabled: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
