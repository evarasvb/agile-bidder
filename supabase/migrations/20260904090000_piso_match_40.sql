-- Piso de match del 40%: bajo eso el calce es ruido ("SOPORTE" con "soporte
-- de monitor", etc.) y ensuciaba la bandeja con "23% match". Se deja de guardar,
-- se limpia lo guardado y las banderas de compras_agiles se recalculan
-- (antes una compra quedaba con match_encontrado=true para siempre).

create or replace function public.sync_compras_agiles_match_flags()
returns integer language plpgsql security definer set search_path = public
as $$
declare n integer; m integer;
begin
  update public.compras_agiles ca
     set match_encontrado = true, match_score = m.best
    from (select compra_agil_codigo, max(score) as best
            from public.ca_matches
           where fecha_cierre >= now() and score >= 40
           group by compra_agil_codigo) m
   where ca.codigo = m.compra_agil_codigo
     and (ca.match_encontrado is distinct from true or ca.match_score is distinct from m.best);
  get diagnostics n = row_count;
  -- Sin matches vigentes (o solo bajo el piso): apagar la bandera.
  update public.compras_agiles ca
     set match_encontrado = false, match_score = null
   where ca.fecha_cierre >= now()
     and (ca.match_encontrado or ca.match_score is not null)
     and not exists (select 1 from public.ca_matches x
                      where x.compra_agil_codigo = ca.codigo and x.fecha_cierre >= now() and x.score >= 40);
  get diagnostics m = row_count;
  return n + m;
end $$;

create or replace function public.generar_matches_ca_todos()
returns integer language plpgsql security definer set search_path = public
as $$
declare c record; total integer := 0;
begin
  for c in select id from public.clientes loop
    total := total + public.generar_matches_ca(c.id, 0.40);
  end loop;
  delete from public.ca_matches where score < 40;
  perform public.sync_compras_agiles_match_flags();
  return total;
end $$;

create or replace function public.generar_matches_ca_items_todos()
returns integer language plpgsql security definer set search_path = public
as $$
declare c record; total integer := 0;
begin
  for c in select id from public.clientes loop
    total := total + public.generar_matches_ca_items(c.id, 0.40);
  end loop;
  delete from public.ca_item_matches where score < 40;
  return total;
end $$;

delete from public.ca_matches where score < 40;
delete from public.ca_item_matches where score < 40;
select public.sync_compras_agiles_match_flags();
