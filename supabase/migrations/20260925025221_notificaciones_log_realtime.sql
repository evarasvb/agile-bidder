-- La campanita (AvisosBell/useAvisos) hacía polling cada 60s; ahora se
-- suscribe por Realtime a notificaciones_log y necesita que la tabla esté en
-- la publicación supabase_realtime para recibir los INSERT/UPDATE al toque.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notificaciones_log') then
    alter publication supabase_realtime add table public.notificaciones_log;
  end if;
end $$;
