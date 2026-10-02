-- Histórico de postulaciones (pedido de Evaristo): dentro de "Postulaciones",
-- una pestaña que muestra a qué procesos ya postuló el cliente (ganó/perdió,
-- institución, fecha de cierre) y a cuáles de su industria NO postuló, para
-- comparar contra quién se las llevó.
--
-- Fuente de "ganó/perdió" en licitaciones: ocds_procesos.oferentes/adjudicatarios
-- (API OCDS pública, ya sincroniza el mercado completo con todos los oferentes
-- por proceso — no solo las órdenes de compra que el cliente ganó). Mercado
-- Público NO publica un historial de "a qué postulaste" por RUT ni la lista de
-- oferentes de una compra ágil: por eso el histórico de compras ágiles queda
-- acotado a las que el cliente efectivamente ganó (ordenes_compra); no se
-- inventa un "perdiste" que no se puede verificar.
--
-- Buen/mal pagador: se lee de public.instituciones (misma fuente que
-- organismo_riesgo/institucion_zoom), no de columnas sueltas en licitaciones_bi
-- (que no las tiene). El link oficial del proceso no se guarda: se arma en el
-- frontend desde el código con el mismo helper que ya usa Instituciones.tsx.

-- RUT tal como viene en ocds_procesos.oferentes/adjudicatarios (jsonb): solo
-- dígitos + dígito verificador, sin puntos ni guión (ej. "782128027").
create or replace function public.rut_limpio(p text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^0-9kK]', '', 'g')), '');
$$;

create index if not exists ocds_procesos_oferentes_gin
  on public.ocds_procesos using gin (oferentes jsonb_path_ops);

-- Licitaciones donde el RUT del cliente aparece como oferente: ganó/perdió,
-- institución y, cuando perdió, quién se adjudicó el proceso.
create or replace function public.mis_postulaciones_licitaciones()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with cli as (
    select public.rut_limpio(c.rut) as rut_limpio
    from public.clientes c
    where c.user_id = auth.uid()
    limit 1
  ),
  procesos as (
    select o.*
    from public.ocds_procesos o, cli
    where cli.rut_limpio is not null
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_limpio))
  )
  select coalesce(jsonb_agg(x order by x.fecha_cierre desc nulls last), '[]'::jsonb)
  from (
    select
      p.codigo,
      coalesce(l.institucion_nombre, p.comprador_nombre) as institucion,
      coalesce(l.institucion_rut, p.comprador_rut) as rut_institucion,
      p.fecha_publicacion,
      p.fecha_cierre,
      coalesce(l.presupuesto_estimado, p.monto_estimado) as monto_estimado,
      'licitacion'::text as tipo,
      (coalesce(p.adjudicatarios, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('rut', cli.rut_limpio))) as gano,
      (
        select string_agg(distinct a->>'nombre', ', ')
        from jsonb_array_elements(coalesce(p.adjudicatarios, '[]'::jsonb)) a
      ) as ganador_nombre,
      p.estado_award,
      i.conducta_pago,
      i.pago_promedio_dias
    from procesos p
    left join public.licitaciones_bi l on l.codigo = p.codigo
    left join public.instituciones i on i.rut = coalesce(l.institucion_rut, p.comprador_rut), cli
  ) x;
$$;

-- Compras ágiles, Convenio Marco y trato directo que el cliente ganó
-- (ordenes_compra propias no ligadas a una licitación). No hay "perdiste esta
-- compra ágil" verificable: Mercado Público no publica la lista de oferentes
-- de una compra ágil.
--
-- El código de la orden de compra NO es el id del proceso que la originó —
-- son numeraciones distintas (ej. una orden "1224957-474-CM26" viene del
-- Convenio Marco "2239-8-LR25", un número de licitación real, guardado en
-- ordenes_compra.convenio_codigo). El sufijo de 2 letras antes del año en el
-- código de la OC (-AG-, -CM-, -TD-, ...) sí identifica de forma confiable el
-- tipo real (AG=Compra Ágil, CM=Convenio Marco, TD=Trato Directo): antes esta
-- función asumía "compra ágil" para cualquier orden sin numero_licitacion, lo
-- que etiquetaba mal las de Convenio Marco (hallazgo de Evaristo revisando
-- datos reales). Para Convenio Marco se usa ese código de licitación real
-- como "oportunidad" (cuando está disponible) y el número de OC va aparte.
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
      b.demandante as institucion,
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

-- Procesos de la industria del cliente (según sus palabras clave de búsqueda)
-- donde NO aparece como oferente: para comparar contra lo que se adjudicó la
-- competencia. Se arma con las mismas palabras clave del onboarding, no con un
-- motor vectorial nuevo (ya existen y ya filtran el resto de "Oportunidades").
create or replace function public.mis_oportunidades_no_tomadas(p_limite integer default 40)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with cli as (
    select
      public.rut_limpio(c.rut) as rut_limpio,
      (
        select array_agg(distinct lower(k))
        from unnest(coalesce(c.palabras_clave_busqueda, '{}'::text[])) k
        where length(k) > 3
      ) as kws
    from public.clientes c
    where c.user_id = auth.uid()
    limit 1
  ),
  lic as (
    select
      l.codigo, l.nombre, l.institucion_nombre as institucion, l.institucion_rut as rut_institucion,
      l.fecha_publicacion, l.fecha_cierre, l.presupuesto_estimado as monto_estimado,
      'licitacion'::text as tipo
    from public.licitaciones_bi l, cli
    where cli.kws is not null
      and exists (select 1 from unnest(cli.kws) k where l.nombre ilike '%' || k || '%' or l.descripcion ilike '%' || k || '%')
      and not exists (
        select 1 from public.ocds_procesos o
        where o.codigo = l.codigo
          and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_limpio))
      )
      and not exists (select 1 from public.pipeline pl where pl.oportunidad_id = l.codigo and pl.oportunidad_tipo = 'licitacion')
  ),
  ca as (
    select
      cagil.codigo, cagil.nombre, cagil.nombre_organismo as institucion, cagil.organismo_rut as rut_institucion,
      cagil.fecha_publicacion, cagil.fecha_cierre, cagil.monto_estimado,
      'compra_agil'::text as tipo
    from public.compras_agiles cagil, cli
    where cli.kws is not null
      and exists (select 1 from unnest(cli.kws) k where cagil.nombre ilike '%' || k || '%' or cagil.descripcion ilike '%' || k || '%')
      and not exists (select 1 from public.pipeline pl where pl.oportunidad_id = cagil.codigo and pl.oportunidad_tipo = 'compra_agil')
  ),
  todas as (
    select * from lic
    union all
    select * from ca
  ),
  con_datos as (
    select
      t.*,
      i.conducta_pago,
      i.pago_promedio_dias,
      (
        select string_agg(distinct a->>'nombre', ', ')
        from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
      ) as ganador_nombre,
      o.estado_award
    from todas t
    left join public.ocds_procesos o on o.codigo = t.codigo and t.tipo = 'licitacion'
    left join public.instituciones i on i.rut = t.rut_institucion
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'codigo', c.codigo, 'nombre', c.nombre, 'institucion', c.institucion, 'rut_institucion', c.rut_institucion,
      'fecha_publicacion', c.fecha_publicacion, 'fecha_cierre', c.fecha_cierre, 'monto_estimado', c.monto_estimado,
      'tipo', c.tipo, 'conducta_pago', c.conducta_pago, 'pago_promedio_dias', c.pago_promedio_dias,
      'ganador_nombre', c.ganador_nombre, 'estado_award', c.estado_award
    ) order by c.fecha_cierre desc nulls last
  ), '[]'::jsonb)
  from (select * from con_datos order by fecha_cierre desc nulls last limit greatest(p_limite, 1)) c;
$$;

grant execute on function public.rut_limpio(text) to anon, authenticated, service_role;
grant execute on function public.mis_postulaciones_licitaciones() to authenticated, service_role;
grant execute on function public.mis_compras_agiles_ganadas() to authenticated, service_role;
grant execute on function public.mis_oportunidades_no_tomadas(integer) to authenticated, service_role;
