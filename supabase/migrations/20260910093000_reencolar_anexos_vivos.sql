-- Backfill: los anexos y demás adjuntos ya bajados (antes de este cambio) nunca se marcaron
-- bases_pendiente porque solo se encolaba la bases principal. Se reencolan ahora (respetando el
-- mismo criterio de tamaño y que no estén ya leídos) para que las crons existentes
-- (licitacion-adjuntos-auto, licitacion-bases-pendientes) los vayan leyendo de a poco, sin gastar
-- cuota de resumen (tipo='anexo'), antes de que la retención de 60 días borre el archivo.
update public.licitaciones_adjuntos a
set bases_pendiente = true
where a.bases_pendiente = false
  and a.es_bases = false
  and a.bytes <= 6 * 1024 * 1024
  and a.content_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  and not exists (select 1 from public.bases_licitacion b where b.codigo = a.codigo and b.archivo = a.nombre);
