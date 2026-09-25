-- Afinado del clasificador por convenio. Hallazgo: 79.000 de las 82.000 OC "Sin clasificar" de
-- 2026 vienen SIN ítems desde la API de detalle (Items.Listado vacío), así que solo tenían el
-- nombre de la OC ("ORDEN DE COMPRA: 1234-56-CM26"). Esas mismas OC sí tienen sus líneas en
-- oc_lineas (carga masiva de datos abiertos): se usan sus productos como texto de respaldo.
-- Además se agregan reglas para textos frecuentes de nombres de OC (víveres, vales de gas,
-- seguros, comisión de servicio, colchones/kits de habitabilidad, arriendo de equipos).

create or replace function public.cm_convenio_de(p_texto text)
returns text language sql immutable as $$
  select case
    when t is null or t = '' then 'Sin clasificar'
    when t ~ '(emergencia|mediagua|kit de alimentos|colchon|frazada|habitabilidad|sabana|almohada|carpa)' then 'Emergencias'
    when t ~ '(pasaje aereo|pasajes aereos|boleto aereo|pasaje|pasajes|comision de servicio|latam|sky airline|jetsmart)' then 'Pasajes aéreos'
    when t ~ '(gas licuado|gas de petroleo|estacion de servicio|bencin|diesel|petroleo|combustible|kerosene|parafina|lubricante|vales? de gas|pelet|pellet|lena|carbon)' then 'Combustibles y lubricantes'
    when t ~ '(seguro complementario|seguro colectivo|seguro de|seguros|poliza)' then 'Seguros'
    when t ~ '(licencia|software|suscripcion|microsoft|adobe|antivirus|office 365|autodesk|oracle|saas|windows server|sql server|paquetes de software)' then 'Software'
    when t ~ '(iaas|paas|nube publica|nube privada|datacenter|data center|hosting|infraestructura t(i|ecnologica)|mantenimiento de software|soporte de infraestructura|ciberseguridad|firewall|ecosistema digital|ventanilla unica)' then 'Servicios TI y nube'
    when t ~ '(computador|laptop|notebook|\maio\M|all in one|monitor|impresora|multifuncional|servidor|tablet|thinkcentre|proone|probook|thinkpad|elitebook|toner|cartucho|disco duro|memoria ram|proyector|scanner|escaner|equipos informaticos|equipos computacionales|ups )' then 'Hardware y computación'
    when t ~ '(guante|quirurgic|jeringa|mascarilla|cateter|panal|aposito|examinacion|hospitalia|muncare|nemocare|sonda|gasa|suero|insumos? medicos?|clinico|medicamento|farmac|pabellon)' then 'Insumos médicos'
    when t ~ '(toalla de papel|bolsa de basura|desinfectante|detergente|cloro|jabon|papel higienico|limpieza|aseo|escobillon|trapero|alcohol gel|lavaloza|interfoliada|wypall)' then 'Aseo e higiene'
    when t ~ '(resma|papel impresion|papel de impresion|lapiz|carpeta|archivador|cuaderno|corchete|destacador|plumon|escritorio y papel|articulos de escritorio|post-it|cinta adhesiva|utiles de oficina|materiales de oficina)' then 'Artículos de escritorio'
    when t ~ '(mobiliario|silla|escritorio|mueble|estante|kardex|mesa de|sillon|cajonera)' then 'Mobiliario'
    when t ~ '(vestuario|calzado|zapato|polera|uniforme|chaqueta|pantalon|parka|bototo|ropa)' then 'Vestuario y calzado'
    when t ~ '(transporte privado de pasajeros|transporte de pasajeros|arriendo de bus|servicio de transporte)' then 'Transporte de pasajeros'
    when t ~ '(camioneta|automovil|vehiculo|furgon|camion|neumatico|minibus|motocicleta)' then 'Vehículos'
    when t ~ '(esmalte|pintura|cemento|tornillo|herramienta|madera|plancha|fierro|ferreter|electric|cable|ampolleta|luminaria|griferia|sanitario|materiales para mejoramiento|materiales de construccion)' then 'Ferretería y construcción'
    when t ~ '(alimentaci|alimento|viveres|economato|rancho|aceite|lacteo|leche|carne|verdura|fruta|bebida|abarrote|colacion|almuerzo|mercaderia)' then 'Alimentos'
    when t ~ '(impresion de|servicio de impresion|imprenta|publicidad|difusion)' then 'Impresión y publicidad'
    when t ~ '(procedimientos administrativos|servicio de|servicios de|consultor|capacitacion|curso|mantencion)' then 'Servicios generales'
    else 'Sin clasificar' end
  from (select public.f_unaccent(lower(coalesce(p_texto, ''))) as t) x;
$$;

-- Texto de una OC: productos del detalle de la API; si no hay, las líneas de oc_lineas; si no, el nombre.
create or replace function public.cm_texto_oc(p_raw jsonb, p_nombre text, p_codigo text default null)
returns text language sql stable set search_path to 'public' as $$
  select coalesce(
    nullif((select string_agg(i->>'Producto', ' | ') from jsonb_array_elements(coalesce(p_raw->'Items'->'Listado', '[]'::jsonb)) i), ''),
    case when p_codigo is null then null else
      nullif((select string_agg(distinct left(l.producto, 120), ' | ') from public.oc_lineas l where l.codigo = p_codigo), '') end,
    p_nombre, '');
$$;
drop function if exists public.cm_texto_oc(jsonb, text);

create or replace function public.oc_asignar_convenio()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.codigo like '%-CM%' then
    new.convenio := public.cm_convenio_de(public.cm_texto_oc(new.raw_json, new.nombre, new.codigo));
  end if;
  return new;
end $$;

-- Las líneas de datos abiertos llegan después que la OC: cuando llegan, se vuelve a
-- clasificar la OC si había quedado sin convenio.
create or replace function public.cm_reclasificar_pendientes(p_dias integer default 90)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.ordenes_compra oc
     set convenio = public.cm_convenio_de(public.cm_texto_oc(oc.raw_json, oc.nombre, oc.codigo))
   where oc.codigo like '%-CM%' and coalesce(oc.convenio, 'Sin clasificar') = 'Sin clasificar'
     and oc.fecha_emision >= now() - make_interval(days => greatest(1, p_dias));
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare v bigint;
begin
  select jobid into v from cron.job where jobname = 'refrescar-cm-convenios';
  if v is not null then perform cron.unschedule(v); end if;
  perform cron.schedule('refrescar-cm-convenios', '20 5 * * *', $cmd$
    set statement_timeout = '20min';
    select public.cm_reclasificar_pendientes(120);
    refresh materialized view concurrently public.mv_cm_por_convenio;
  $cmd$);
end $$;
