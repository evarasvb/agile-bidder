-- Eliminar (borrar de verdad) un libro de licitación del usuario: su historial de
-- chat/informes/entregables sobre esa licitación y sus documentos propios subidos.
-- Nunca toca las bases (bases_licitacion son compartidas entre todos los usuarios).
create or replace function public.experto_libro_eliminar(p_codigo text)
returns void
language sql
security definer
set search_path = 'public', 'experto'
as $$
  delete from experto.consultas where user_id = auth.uid() and upper(licitacion) = upper(p_codigo);
  delete from experto.documentos where user_id = auth.uid() and upper(codigo) = upper(p_codigo);
  delete from public.experto_anexos where user_id = auth.uid() and upper(codigo) = upper(p_codigo);
  delete from experto.libros_meta where user_id = auth.uid() and codigo = upper(p_codigo);
$$;
comment on function public.experto_libro_eliminar is 'Borra el libro de licitación del usuario (chat, informes, entregables, documentos propios). No toca bases_licitacion (compartidas entre usuarios).';
