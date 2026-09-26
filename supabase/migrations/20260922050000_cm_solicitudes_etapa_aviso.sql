-- Convenio Marco: soporte para el flujo de 2 etapas (carta de aviso -> solicitud
-- de baja) y snapshot de las órdenes de compra usadas como evidencia.
alter table public.cm_solicitudes
  add column if not exists etapa text not null default 'aviso'
    check (etapa in ('aviso', 'baja'));

alter table public.cm_solicitudes
  add column if not exists ordenes jsonb not null default '[]'::jsonb;
