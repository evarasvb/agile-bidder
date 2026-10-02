-- Corrige mis_compras_agiles_ganadas(): separa la institución real del área
-- compradora (hallazgo de Evaristo con datos reales, 02-oct).
--
-- ordenes_compra.demandante es el ÁREA COMPRADORA (ej. "CMDS Nivel Central"),
-- NO el nombre de la institución (ej. "CORP MUNICIPAL DE DESARROLLO SOCIAL DE
-- NUNOA") — mostrarlo como "institución" era confuso. La institución real
-- sale de public.instituciones por rut_demandante (misma fuente que
-- organismo_riesgo); se usa como fallback cuando no hay match.
--
-- Va en una migración nueva (no se edita 20261002000000_historico_postulaciones.sql)
-- porque Supabase registra las migraciones ya aplicadas por su nombre de
-- archivo: editar una que ya corrió en un ambiente no vuelve a ejecutarla ahí
-- (hallazgo de Codex) — ese CREATE OR REPLACE nunca llegaría a esa base.
create or replace function public.mis_compras_agiles_ganadas()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with cli as (
    select public.rut_normalizar(c.rut) as rut
    from public.clientes c
    where c.user_id = auth.uid()
    limit 1
  ),
  base as (
    select
      oc.*,
      upper((regexp_match(oc.codigo, '-([A-Za-z]+)\d{2}$'))[1]) as sufijo
    from public.ordenes_compra oc, cli
    where cli.rut is not null
      and oc.rut_proveedor = cli.rut
      and (oc.numero_licitacion is null or oc.numero_licitacion = '')
  )
  select coalesce(jsonb_agg(x order by x.fecha_cierre desc nulls last), '[]'::jsonb)
  from (
    select
      case
        when b.sufijo = 'CM' and b.convenio_codigo is not null and b.convenio_codigo <> ''
          then b.convenio_codigo
        else b.codigo
      end as codigo,
      b.codigo as orden_compra_codigo,
      b.link_oficial as orden_compra_link,
      coalesce(i.nombre, b.demandante) as institucion,
      b.demandante as area_compradora,
      b.rut_demandante as rut_institucion,
      b.fecha_envio_oc as fecha_publicacion,
      b.fecha_emision as fecha_cierre,
      coalesce(b.total, b.monto_total, 0) as monto_estimado,
      case b.sufijo
        when 'AG' then 'compra_agil'
        when 'CM' then 'convenio_marco'
        when 'TD' then 'trato_directo'
        else 'otro'
      end::text as tipo,
      true as gano,
      b.proveedor as ganador_nombre,
      null::text as estado_award,
      i.conducta_pago,
      i.pago_promedio_dias
    from base b
    left join public.instituciones i on i.rut = b.rut_demandante
  ) x;
$$;

grant execute on function public.mis_compras_agiles_ganadas() to authenticated, service_role;
