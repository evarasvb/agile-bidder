-- Manual rollback, only after review. Never run automatically on deploy.
-- ADD CHECK validates existing rows: if any new type is stored, the entire
-- transaction fails, preserving the nine-type constraint and every document.
-- In that case keep the forward schema; do not delete/relabel documents.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

alter table public.cliente_documentos
  drop constraint cliente_documentos_tipo_check,
  add constraint cliente_documentos_tipo_check check (tipo in (
    'ficha_tecnica', 'certificado', 'catalogo', 'otro'
  ));

commit;
