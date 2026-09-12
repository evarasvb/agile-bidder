-- Marca de "ya pasó por OCR": si el lector vuelve a encontrar el PDF sin texto, no lo reencola en bucle.
alter table public.licitaciones_adjuntos add column if not exists ocr_hecho boolean not null default false;
