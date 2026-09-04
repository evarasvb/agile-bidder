-- Reintento de detalle de compras ágiles: las que fallaron (timeout de la API) se marcan con
-- detalle_scrapeado=false y detalle_actualizado_at=now(); vuelven a la cola 2 horas después
-- en vez de reintentarse en cada corrida y bloquear un cupo.
create index if not exists idx_ca_detalle_fallido
  on public.compras_agiles (fecha_cierre)
  where detalle_scrapeado is not true;

create or replace function public.compras_agiles_pendientes_items(p_limit integer default 60)
returns table(id bigint, codigo text)
language sql security definer set search_path to 'public'
as $$
  select c.id, c.codigo
  from public.compras_agiles c
  where (c.estado ilike 'publicada' or c.estado ilike 'activa')
    and c.fecha_cierre > now() and c.codigo is not null
    and (c.detalle_actualizado_at is null
         or (c.detalle_scrapeado is not true and c.detalle_actualizado_at < now() - interval '2 hours'))
  order by c.detalle_actualizado_at nulls first, c.fecha_cierre asc
  limit greatest(1, least(p_limit, 100));
$$;

-- Crones del listado de compras ágiles (aplicados en producción el 04-09-2026, documentados aquí):
--   fetch-compras-agiles-v3-cron (job 54): cada 5 min, {"ttl_cambio_ms":21600000,"max_paginas":3,"reiniciar":true}
--     => páginas 1-3 de la ventana de 6 h (lo recién publicado), timeout pg_net 120 s.
--   fetch-compras-agiles-horario (job 60): minuto 35 de cada hora, {"ttl_cambio_ms":21600000,"max_paginas":3,"desde_pagina":4}
--     => páginas 4-6 de la misma ventana, por si un pico de cambios empuja lo nuevo más abajo.
--   fetch-compras-agiles-nocturno (job 59): 04:15 UTC, {"ttl_cambio_ms":43200000,"max_paginas":3,"reiniciar":true}.
-- Con ventanas de 12 h o más la API de ChileCompra supera sus 30 s y responde 504; con 1-3 h devuelve 0 páginas.
