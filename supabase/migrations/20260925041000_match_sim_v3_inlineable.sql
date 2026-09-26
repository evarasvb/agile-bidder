-- match_sim_v3 sin CTE: con el "with s as (...)" Postgres no podía inlinear la función y
-- la llamaba fila por fila (~100 candidatos por ítem), 6 veces más lento que el match de
-- texto. Como expresión única se inlinea en el plan; la distancia se calcula hasta tres
-- veces pero son microsegundos.
create or replace function public.match_sim_v3(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_inv_emb extensions.vector,
  p_item_norm text, p_item_cod text, p_item_emb extensions.vector)
returns real language sql immutable as $$
  select greatest(
    public.match_sim(p_inv_norm, p_inv_busqueda, p_inv_cod, p_item_norm, p_item_cod),
    case
      when p_inv_emb is null or p_item_emb is null then 0::real
      when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
           and least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.68) / 0.18)::real)) >= 0.30
        then 0.5::real + 0.5::real * least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.68) / 0.18)::real))
      else least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.68) / 0.18)::real))
    end);
$$;
