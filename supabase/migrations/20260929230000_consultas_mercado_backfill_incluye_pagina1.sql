-- Hallazgo P2 de Codex sobre la PR (commit 8dc030f): el cursor de backfill
-- arrancaba (y reiniciaba) en 2, así que la página 1 —que también trae RF
-- propias, las más antiguas de la ventana— nunca se guardaba. Se corrige en
-- la edge function (cursor arranca/reinicia en 1) y se reinicia el estado ya
-- vivo en producción para que el próximo ciclo la cubra de una.
alter table public.consultas_mercado_sync_estado
  alter column ultima_pagina_backfill set default 1;

update public.consultas_mercado_sync_estado set ultima_pagina_backfill = 1, updated_at = now() where id = true;
