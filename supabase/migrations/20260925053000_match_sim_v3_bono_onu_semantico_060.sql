-- Ajuste tras revisar los primeros matches con Mistral: el bono por código ONU en el camino
-- semántico se activaba con sem >= 0.30 (coseno 0.836) y subía a 70 % pares de la misma
-- familia pero distinto producto ("fundas oficio 100 u" -> "papel arroz 100 un", "plancha
-- acrílica 1,8 x 2,4 m" -> "plancha para corte 60 x 90"). Ahora el bono semántico exige
-- sem >= 0.60 (coseno >= 0.872, donde ya es el mismo producto). El camino de texto no cambia.
create or replace function public.match_sim_v3(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_inv_emb extensions.vector,
  p_item_norm text, p_item_cod text, p_item_emb extensions.vector)
returns real language sql immutable as $$
  select greatest(
    public.match_sim(p_inv_norm, p_inv_busqueda, p_inv_cod, p_item_norm, p_item_cod),
    case
      when p_inv_emb is null or p_item_emb is null then 0::real
      when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
           and least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real)) >= 0.60
        then 0.5::real + 0.5::real * least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
      else least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
    end);
$$;
