// DEPRECATED 2026-05-12 - sustituida por la Edge Function 'match-opportunities' del repo agile-bidder
// TODO: borrar físicamente desde el Dashboard de Supabase.
Deno.serve(() => new Response(
  JSON.stringify({ error: 'gone', message: 'Edge Function deprecated. Usar match-opportunities. Borrar desde Dashboard.' }),
  { status: 410, headers: { 'Content-Type': 'application/json' } }
));
