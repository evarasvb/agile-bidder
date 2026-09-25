-- Reporte "por convenio" del Convenio Marco. Mercado Público no entrega el ID del convenio en
-- las órdenes de compra (la API devuelve CodigoLicitacion vacío y CodigoProducto 0 para las
-- OC -CM), así que el convenio se deduce del nombre de los productos, que en la tienda CM es
-- estandarizado ("PASAJE AÉREO NACIONAL", "GAS LICUADO CILINDRO…", "LICENCIA MICROSOFT…").
-- Fuente de montos: ordenes_compra (total = CLP con IVA, incluso para OC en USD/UF; el neto
-- de esas viene en la moneda original). oc_lineas no sirve para esto: sus montos de OC en USD
-- quedan en USD y a las OC recientes les faltan líneas.

create or replace function public.cm_convenio_de(p_texto text)
returns text language sql immutable as $$
  select case
    when t is null or t = '' then 'Sin clasificar'
    when t ~ '(emergencia|vivienda de emergencia|viviendas de emergencia|kit de alimentos|mediagua)' then 'Emergencias'
    when t ~ '(pasaje aereo|pasajes aereos|boleto aereo)' then 'Pasajes aéreos'
    when t ~ '(gas licuado|gas de petroleo|estacion de servicio|bencin|diesel|petroleo|combustible|kerosene|parafina|lubricante)' then 'Combustibles y lubricantes'
    when t ~ '(licencia|software|suscripcion|microsoft|adobe|antivirus|office 365|autodesk|oracle|saas|windows server|sql server|paquetes de software)' then 'Software'
    when t ~ '(iaas|paas|nube publica|nube privada|datacenter|data center|hosting|infraestructura t(i|ecnologica)|mantenimiento de software|soporte de infraestructura|ciberseguridad|firewall)' then 'Servicios TI y nube'
    when t ~ '(computador|laptop|notebook|\maio\M|all in one|monitor|impresora|multifuncional|servidor|tablet|thinkcentre|proone|probook|thinkpad|elitebook|toner|cartucho|disco duro|memoria ram|proyector|scanner|escaner|ups )' then 'Hardware y computación'
    when t ~ '(guante|quirurgic|jeringa|mascarilla|cateter|panal|aposito|examinacion|hospitalia|muncare|nemocare|sonda|gasa|suero|insumo medico|clinico|medicamento|farmac)' then 'Insumos médicos'
    when t ~ '(toalla de papel|bolsa de basura|desinfectante|detergente|cloro|jabon|papel higienico|limpieza|aseo|escobillon|trapero|alcohol gel|lavaloza)' then 'Aseo e higiene'
    when t ~ '(resma|papel impresion|papel de impresion|lapiz|carpeta|archivador|cuaderno|corchete|destacador|plumon|escritorio y papel|articulos de escritorio|post-it|cinta adhesiva)' then 'Artículos de escritorio'
    when t ~ '(mobiliario|silla|escritorio|mueble|estante|kardex|mesa de|sillon|cajonera)' then 'Mobiliario'
    when t ~ '(vestuario|calzado|zapato|polera|uniforme|chaqueta|pantalon|parka|bototo|ropa)' then 'Vestuario y calzado'
    when t ~ '(transporte privado de pasajeros|transporte de pasajeros|arriendo de bus|servicio de transporte)' then 'Transporte de pasajeros'
    when t ~ '(camioneta|automovil|vehiculo|furgon|camion|neumatico|minibus|motocicleta)' then 'Vehículos'
    when t ~ '(esmalte|pintura|cemento|tornillo|herramienta|madera|plancha|fierro|ferreter|electric|cable|ampolleta|luminaria|griferia|sanitario)' then 'Ferretería y construcción'
    when t ~ '(alimentaci|alimento|aceite|lacteo|leche|carne|verdura|fruta|bebida|abarrote|colacion|almuerzo)' then 'Alimentos'
    when t ~ '(seguro de|poliza)' then 'Seguros'
    when t ~ '(impresion de|servicio de impresion|imprenta|publicidad|difusion)' then 'Impresión y publicidad'
    when t ~ '(procedimientos administrativos|servicio de|servicios de|consultor|capacitacion|curso)' then 'Servicios generales'
    else 'Sin clasificar' end
  from (select public.f_unaccent(lower(coalesce(p_texto, ''))) as t) x;
$$;

-- Texto de una OC para clasificar: todos los productos del detalle, o el nombre de la OC.
create or replace function public.cm_texto_oc(p_raw jsonb, p_nombre text)
returns text language sql immutable as $$
  select coalesce(
    nullif((select string_agg(i->>'Producto', ' | ') from jsonb_array_elements(coalesce(p_raw->'Items'->'Listado', '[]'::jsonb)) i), ''),
    p_nombre, '');
$$;

alter table public.ordenes_compra add column if not exists convenio text;

create or replace function public.oc_asignar_convenio()
returns trigger language plpgsql as $$
begin
  if new.codigo like '%-CM%' then
    new.convenio := public.cm_convenio_de(public.cm_texto_oc(new.raw_json, new.nombre));
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_asignar_convenio on public.ordenes_compra;
create trigger trg_oc_asignar_convenio before insert or update of raw_json, nombre on public.ordenes_compra
for each row execute function public.oc_asignar_convenio();

create index if not exists idx_oc_convenio_fecha on public.ordenes_compra (convenio, fecha_emision desc) where convenio is not null;

-- Resumen mensual por convenio (se refresca a diario).
create materialized view if not exists public.mv_cm_por_convenio as
select extract(year from fecha_emision)::int as anio,
       date_trunc('month', fecha_emision)::date as mes,
       convenio,
       count(*)::int as ocs,
       sum(coalesce(total, 0))::numeric as monto_total,
       count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores,
       count(distinct coalesce(rut_demandante, demandante))::int as organismos
from public.ordenes_compra
where convenio is not null and fecha_emision is not null and codigo like '%-CM%'
group by 1, 2, 3
with no data;
create unique index if not exists ux_mv_cm_por_convenio on public.mv_cm_por_convenio (anio, mes, convenio);

-- RPCs para el reporte.
create or replace function public.cm_por_convenio(p_anio integer default extract(year from now())::int)
returns table (convenio text, ocs bigint, monto_total numeric, proveedores integer, organismos integer, participacion numeric)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select convenio, sum(ocs) ocs, sum(monto_total) monto_total
    from public.mv_cm_por_convenio where anio = p_anio group by 1
  ),
  distintos as (
    select convenio, count(distinct coalesce(rut_proveedor, proveedor))::int proveedores, count(distinct coalesce(rut_demandante, demandante))::int organismos
    from public.ordenes_compra where convenio is not null and codigo like '%-CM%'
      and fecha_emision >= make_date(p_anio,1,1) and fecha_emision < make_date(p_anio+1,1,1)
    group by 1
  )
  select b.convenio, b.ocs, b.monto_total, d.proveedores, d.organismos,
         round(100 * b.monto_total / nullif(sum(b.monto_total) over (), 0), 1) participacion
  from base b left join distintos d using (convenio)
  order by b.monto_total desc;
$$;

create or replace function public.cm_convenio_meses(p_convenio text, p_anio integer default extract(year from now())::int)
returns table (mes date, ocs integer, monto_total numeric)
language sql stable security definer set search_path to 'public' as $$
  select mes, ocs, monto_total from public.mv_cm_por_convenio where convenio = p_convenio and anio = p_anio order by mes;
$$;

create or replace function public.cm_convenio_top(p_convenio text, p_anio integer default extract(year from now())::int, p_limite integer default 10)
returns table (tipo text, nombre text, rut text, ocs bigint, monto_total numeric)
language sql stable security definer set search_path to 'public' as $$
  (select 'proveedor'::text, coalesce(proveedor, proveedor_nombre), rut_proveedor, count(*), sum(coalesce(total,0))
   from public.ordenes_compra where convenio = p_convenio and codigo like '%-CM%'
     and fecha_emision >= make_date(p_anio,1,1) and fecha_emision < make_date(p_anio+1,1,1)
   group by 2, 3 order by 5 desc limit greatest(1, least(p_limite, 50)))
  union all
  (select 'comprador'::text, coalesce(demandante, organismo_comprador), rut_demandante, count(*), sum(coalesce(total,0))
   from public.ordenes_compra where convenio = p_convenio and codigo like '%-CM%'
     and fecha_emision >= make_date(p_anio,1,1) and fecha_emision < make_date(p_anio+1,1,1)
   group by 2, 3 order by 5 desc limit greatest(1, least(p_limite, 50)));
$$;

revoke execute on function public.cm_por_convenio(integer), public.cm_convenio_meses(text, integer), public.cm_convenio_top(text, integer, integer) from public, anon;
grant execute on function public.cm_por_convenio(integer), public.cm_convenio_meses(text, integer), public.cm_convenio_top(text, integer, integer) to authenticated, service_role;

-- Refresco diario (la vista se llena por primera vez al terminar el relleno inicial).
do $$
declare v bigint;
begin
  select jobid into v from cron.job where jobname = 'refrescar-cm-convenios';
  if v is not null then perform cron.unschedule(v); end if;
  perform cron.schedule('refrescar-cm-convenios', '20 5 * * *', $cmd$
    set statement_timeout = '15min';
    refresh materialized view concurrently public.mv_cm_por_convenio;
  $cmd$);
end $$;
