-- Bases en Word (.docx) también se leen (experto-bases las acepta): los Word ya bajados que
-- parecen bases van a la cola de lectura, y la cola atiende primero los nunca intentados.

update public.licitaciones_adjuntos a set bases_pendiente = true
where content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  and bytes <= 6 * 1024 * 1024 and not es_bases and not bases_pendiente
  and nombre ~* 'bases|resol|administrativ|t[ée]cnic|licitaci|aprueba'
  and nombre !~* '^\s*(anexo|formulario|formato|declaraci[oó]n|carta|acta)'
  and not exists (select 1 from public.bases_licitacion b where b.codigo = a.codigo and b.archivo = a.nombre);

create index if not exists licitaciones_adjuntos_bases_cola_idx
  on public.licitaciones_adjuntos (bases_intento_en nulls first, bajado_en) where bases_pendiente;
