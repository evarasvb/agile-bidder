-- La página pública fallaba: "vistas" era ambiguo entre la columna y la columna de salida de la función.
create or replace function public.experto_compartido(p_token text)
returns table(codigo text, tipo text, titulo text, empresa text, contenido text, creado_en timestamptz, vistas integer)
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.experto_compartidos c set vistas = c.vistas + 1 where c.token = p_token;
  return query select c.codigo, c.tipo, c.titulo, c.empresa, c.contenido, c.creado_en, c.vistas from public.experto_compartidos c where c.token = p_token;
end $function$;
