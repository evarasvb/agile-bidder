-- Adjuntos que el lector no puede abrir directo y quedaron sin leer ni rastro:
-- PDF de más de 6 MB, Word (.doc/.docx) y comprimidos (ZIP/RAR). Pasan a la cola
-- de conversión (ocr_pendiente) que atiende el workflow "Convertir y OCR bases"
-- (Ghostscript / LibreOffice / extracción de ZIP) y vuelven a la cola de lectura.
-- Idempotente: solo toca filas que nunca pasaron por la conversión.
update public.licitaciones_adjuntos
set ocr_pendiente = true, bases_intentos = 0
where not es_bases
  and not bases_pendiente
  and not ocr_pendiente
  and not coalesce(ocr_hecho, false)
  and (
    (content_type = 'application/pdf' and bytes > 6 * 1024 * 1024)
    or content_type = 'application/msword'
    or content_type like '%wordprocessingml%'
    or content_type like '%zip%'
    or content_type like '%rar%'
  );
