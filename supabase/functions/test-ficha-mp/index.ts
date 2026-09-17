import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Diagnóstico desactivado. Borrable: Supabase -> Edge Functions -> test-ficha-mp -> Delete.
Deno.serve(() => new Response(JSON.stringify({ disabled: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
