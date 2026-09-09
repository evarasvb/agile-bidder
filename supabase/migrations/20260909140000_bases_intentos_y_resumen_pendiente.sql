-- Cola de lectura sin reintentos infinitos: tras 3 intentos fallidos el archivo sale de la cola.
alter table public.licitaciones_adjuntos add column if not exists bases_intentos integer not null default 0;

-- Bases guardadas sin resumen (Gemini sin cuota en ese momento): se resumen después, de a pocas, cada hora.
create index if not exists bases_licitacion_sin_resumen_idx on public.bases_licitacion (creado_en desc) where resumen is null;

select cron.unschedule(jobid) from cron.job where jobname = 'bases-resumen-pendiente';
select cron.schedule('bases-resumen-pendiente', '41 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/experto-bases',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"resumir_pendientes":true,"limit":8}'::jsonb, timeout_milliseconds := 120000);
$$);

-- El PDF firmado que el OCR dejó sobre 6 MB vuelve a la cola de OCR: el workflow ahora lo comprime.
update public.licitaciones_adjuntos set ocr_pendiente = true, ocr_hecho = false
where ocr_hecho and not es_bases and not bases_pendiente and content_type = 'application/pdf' and bytes > 6 * 1024 * 1024;
