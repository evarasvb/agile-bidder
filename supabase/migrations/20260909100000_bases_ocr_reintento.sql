-- experto-bases ahora transcribe (OCR con Gemini) los PDF escaneados: los que quedaron
-- descartados como "sin texto" vuelven a la cola de lectura una vez más.
update public.licitaciones_adjuntos a
set bases_pendiente = true, bases_intento_en = null
where content_type = 'application/pdf' and not es_bases and not bases_pendiente
  and bases_intento_en is not null and bytes <= 6 * 1024 * 1024
  and nombre ~* 'bases|resol|administrativ|t[ée]cnic|licitaci|aprueba'
  and nombre !~* '^\s*(anexo|formulario|formato|declaraci[oó]n|carta|acta)'
  and not exists (select 1 from public.bases_licitacion b where b.codigo = a.codigo and b.archivo = a.nombre);
