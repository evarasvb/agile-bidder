-- Nivel 2 (ranking): afinidad/aversión aprendida del comportamiento, para
-- reordenar el panel. Resuelve el cliente por auth.uid() (sin pasar id).
create or replace function public.cliente_afinidad()
returns jsonb
language sql stable security definer set search_path = public
as $function$
  with me as (
    select id from public.clientes where user_id = (select auth.uid()) limit 1
  ),
  stop as (
    select unnest(array['para','con','sin','por','los','las','del','una','uno','que','the','and',
      'servicio','servicios','adquisicion','compra','contratacion','suministro','provision','arriendo',
      'municipalidad','hospital','ilustre','direccion','region','regional','comunal','publico','publica',
      'material','materiales','insumo','insumos','varios','varias','general','generales','ano','anos']) as w
  ),
  toks as (
    select s.tipo, t as w
    from public.cliente_senales s
    join me on me.id = s.cliente_id,
      regexp_split_to_table(lower(public.f_unaccent(coalesce(s.titulo,''))), '[^a-z]+') t
    where s.created_at > now() - interval '120 days'
  ),
  af as (
    select w, count(*) c from toks where tipo='cotizada' and length(w)>=4 and w not in (select w from stop) group by w order by c desc limit 20
  ),
  av as (
    select w, count(*) c from toks where tipo='descartada' and length(w)>=4 and w not in (select w from stop) group by w order by c desc limit 20
  )
  select jsonb_build_object(
    'afinidad', coalesce((select array_agg(w) from af), '{}'::text[]),
    'aversion', coalesce((select array_agg(w) from av), '{}'::text[])
  );
$function$;

grant execute on function public.cliente_afinidad() to anon, authenticated;
