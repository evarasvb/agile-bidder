-- Realtime solo debe publicar tablas con consumidores activos. Las tablas de
-- datos masivos o con fallback de consulta normal aumentaban conexiones y
-- superficie de exposición sin aportar comportamiento visible.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'analisis_competencia',
    'asignaciones_licitaciones',
    'compras_agiles',
    'compras_agiles_items',
    'extension_activity_log',
    'historial_compradores',
    'licitacion_items',
    'notifications',
    'revisiones_ordenes_compra'
  ]
  loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime drop table %I.%I',
        'public',
        v_table
      );
    end if;
  end loop;
end
$$;
