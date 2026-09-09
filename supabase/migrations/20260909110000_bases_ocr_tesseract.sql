-- OCR gratis para bases escaneadas: el lector marca ocr_pendiente cuando el PDF no trae texto y el
-- workflow ocr-bases (GitHub Actions, Tesseract en español) le agrega la capa de texto y lo reencola.
alter table public.licitaciones_adjuntos add column if not exists ocr_pendiente boolean not null default false;
create index if not exists licitaciones_adjuntos_ocr_pendiente_idx on public.licitaciones_adjuntos (bajado_en) where ocr_pendiente;

-- PDF que parecen bases, ya intentados y aún sin leer: a la cola de OCR.
update public.licitaciones_adjuntos a set ocr_pendiente = true
where content_type = 'application/pdf' and not es_bases and not bases_pendiente and not ocr_pendiente
  and bases_intento_en is not null and bytes <= 6 * 1024 * 1024
  and nombre ~* 'bases|resol|administrativ|t[ée]cnic|licitaci|aprueba'
  and nombre !~* '^\s*(anexo|formulario|formato|declaraci[oó]n|carta|acta)'
  and not exists (select 1 from public.bases_licitacion b where b.codigo = a.codigo and b.archivo = a.nombre);
