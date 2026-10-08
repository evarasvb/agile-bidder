BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE public.cliente_documentos
  DROP CONSTRAINT cliente_documentos_tipo_check,
  ADD CONSTRAINT cliente_documentos_tipo_check CHECK (tipo = ANY (ARRAY[
    'ficha_tecnica'::text,
    'certificado'::text,
    'catalogo'::text,
    'otro'::text,
    'carpeta_tributaria'::text,
    'vigencia_poderes'::text,
    'cedula_representante'::text,
    'escritura_constitucion'::text,
    'registro_proveedores'::text
  ]));
COMMIT;