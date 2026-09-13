// Diagnóstico desactivado (se usó para verificar el detalle de ítems de MP).
Deno.serve(() => new Response(JSON.stringify({ disabled: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
