-- Un organismo cuya consulta falló (p. ej. Google Noticias 503 en ráfaga) se reintenta a la hora,
-- no a los 7 días.
create or replace function public.medios_organismos_pendientes(p_limite integer default 8)
returns table (organismo text)
language sql stable security definer set search_path = public as $$
  select l.institucion_nombre
  from public.licitaciones_bi l
  left join public.medios_organismos_estado e on e.organismo_norm = public.medios_norm(l.institucion_nombre)
  where l.codigo_estado = 5 and l.fecha_cierre > now() and l.institucion_nombre is not null
    and (e.organismo_norm is null
         or e.revisado_en < now() - interval '7 days'
         or (e.error is not null and e.revisado_en < now() - interval '1 hour'))
  group by l.institucion_nombre, e.revisado_en
  order by bool_or(l.match_encontrado) desc, count(*) desc, e.revisado_en asc nulls first
  limit greatest(1, least(coalesce(p_limite, 8), 20));
$$;
