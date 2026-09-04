-- "Quién vende esto al Estado" buscaba con las dos primeras palabras del nombre de ítem
-- ("Software de"), una categoría genérica de Mercado Público: aparecía Lirmi (software
-- educativo) en una compra de licencias Google/Adobe. Ahora arma la búsqueda con las marcas
-- y productos reales de la DESCRIPCIÓN de cada ítem (frase de dos palabras + marca sola).
-- La ficha del libro (experto_ficha_licitacion) y el estudio profundo usan este texto.
create or replace function public.experto_texto_competencia(p_codigo text)
returns text language sql stable security definer set search_path = public as $$
  with l as (select id, nombre from licitaciones_bi where codigo = upper(p_codigo) order by fecha_publicacion desc nulls last limit 1),
  it as (
    select coalesce(nullif(trim(i.descripcion), ''), i.nombre_producto) as t, i.correlativo
    from licitaciones_bi_items i, l where i.licitacion_id = l.id
    union all select l.nombre, 9999 from l where not exists (select 1 from licitaciones_bi_items i, l l2 where i.licitacion_id = l2.id)
  ),
  palabras as (
    select it.correlativo, w, ord
    from it, regexp_split_to_table(lower(public.quitar_acentos(regexp_replace(it.t, '[^[:alnum:]áéíóúñÁÉÍÓÚÑ ]+', ' ', 'g'))), '\s+') with ordinality as p(w, ord)
    where length(w) >= 3 and w !~ '^\d+$'
      and w not in ('renovacion','licenciamiento','licencia','licencias','suscripcion','suscripciones','servicio','servicios','software','plan','para','con','por','segun','bases','adjuntas','adjunta','equipos','usuarios','usuario','instancias','modalidad','linea','nube','compatible','plataforma','gestion','adquisicion','compra','contratacion','capacidad','hasta','tecnicas','tecnica','anexo','unico','unica','perpetuo','flotante','completa','coleccion','del','las','los','una','uno','que','sus','mas','tramo','herramienta','sistema','solucion','acuerdo','anual','meses','anos','ano','version','tipo','nivel','pro','business','standard','enterprise','basic','premium')
  ),
  top2 as (
    select correlativo, w, rn from (select correlativo, w, ord, row_number() over (partition by correlativo order by ord) rn from palabras) x where rn <= 2
  ),
  frases as (
    select correlativo,
      '"' || string_agg(w, ' ' order by rn) || '"' as frase,
      (array_agg(w order by rn))[1] as marca
    from top2 group by correlativo
  )
  select string_agg(distinct termino, ' OR ')
  from (
    select frase as termino from (select * from frases order by correlativo limit 12) a
    union
    select marca from (select * from frases order by correlativo limit 12) b
     where marca not in ('seguridad','proteccion','certificado','antivirus','respaldo','soporte','mantencion','desarrollo','diseno','inteligencia','consulta','normativa','presupuestos','herramientas','correo','dominio','web','datos','base','red','redes','equipo','computador','notebook','impresora','papel','materiales','insumos','articulos','muebles','mobiliario','vehiculo','vehiculos','arriendo','transporte','alimentos','limpieza','aseo','ropa','uniformes','obras','construccion','reparacion','instalacion','capacitacion','curso','cursos','asesoria','consultoria','estudio','evaluacion','auditoria','publicidad','difusion','impresion','eventos','catering','seguros','seguro','pasajes','hotel','alojamiento')
  ) z;
$$;
revoke all on function public.experto_texto_competencia(text) from public, anon;
grant execute on function public.experto_texto_competencia(text) to authenticated, service_role;

do $$
declare def text;
begin
  select pg_get_functiondef('public.experto_ficha_licitacion'::regproc) into def;
  def := regexp_replace(def, 'public\.experto_competencia\(\s*\(select string_agg\(split_part.*?limit 3\) s\),\s*12,\s*6\)', 'public.experto_competencia(coalesce(public.experto_texto_competencia((select codigo from l)), (select nombre from l)), 12, 6)');
  if def like '%experto_texto_competencia%' then execute def; end if;
end $$;
