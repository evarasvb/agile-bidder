-- Precio de mercado por producto para el modal de propuesta (front, usuarios con cuenta):
-- resume lo que el Estado pago en OC reales en 12 meses (misma base que usa el Experto).
create or replace function public.precio_mercado(p_texto text)
returns table (proveedores integer, ordenes integer, precio_min numeric, precio_mediano numeric, precio_max numeric, lider text, lider_precio numeric)
language sql stable security definer set search_path = public as $$
  with c as (select * from public.experto_competencia(p_texto, 12, 8) where precio_unit_mediano > 0)
  select count(*)::int, coalesce(sum(c.ordenes), 0)::int,
         min(c.precio_unit_mediano), percentile_cont(0.5) within group (order by c.precio_unit_mediano), max(c.precio_unit_mediano),
         (select c2.proveedor from c c2 order by c2.ordenes desc limit 1),
         (select c2.precio_unit_mediano from c c2 order by c2.ordenes desc limit 1)
  from c;
$$;
grant execute on function public.precio_mercado(text) to authenticated;
