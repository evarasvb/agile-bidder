-- La página Compras Ágiles (y su filtro "Con match") lee compras_agiles.
-- match_encontrado/match_score, pero el motor solo escribía en ca_matches:
-- todo aparecía "Sin match" aunque hubiera cientos de calces. Este sync marca
-- la compra si ALGÚN cliente tiene match (score = el mejor), y se encadena al
-- final de la corrida de matches.
create or replace function public.sync_compras_agiles_match_flags()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  update public.compras_agiles ca
  set match_encontrado = true,
      match_score = m.best
  from (
    select compra_agil_codigo, max(score) as best
    from public.ca_matches
    where fecha_cierre >= now()
    group by compra_agil_codigo
  ) m
  where ca.codigo = m.compra_agil_codigo
    and (ca.match_encontrado is distinct from true or ca.match_score is distinct from m.best);
  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.generar_matches_ca_todos()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c record; total integer := 0;
begin
  for c in select id from public.clientes loop
    total := total + public.generar_matches_ca(c.id, 0.30);
  end loop;
  perform public.sync_compras_agiles_match_flags();
  return total;
end $function$;
