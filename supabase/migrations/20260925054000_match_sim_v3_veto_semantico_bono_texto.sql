-- Con los vectores ya disponibles, el bono por código ONU del camino de TEXTO (que se activa
-- con trigramas >= 0.30) seguía produciendo falsos positivos por palabras sueltas:
-- "resma opalina carta 100 hojas" -> "cuaderno 100 hojas" 76 %, "goma eva colores surtidos"
-- -> "cordel papel colores surtidos" 76 %, "fundas oficio 100u" -> "resma oficio" 69 %.
-- Ahora ese bono se veta cuando ambos vectores existen y el coseno es de nivel azar
-- (< 0.818, sem < 0.15): quedan con el trigrama pelado (~30-40 %, "dudoso"). Sin vectores,
-- todo sigue igual que antes. match_sim (texto puro) no cambia; se replica aquí inlineable.
create or replace function public.match_sim_v3(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_inv_emb extensions.vector,
  p_item_norm text, p_item_cod text, p_item_emb extensions.vector)
returns real language sql immutable as $$
  select case when p_item_norm is null then 0::real else greatest(
    -- texto: trigramas estrictos con bono ONU (vetado si los vectores dicen "no se parecen")
    case
      when p_inv_norm is null then 0::real
      when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
           and strict_word_similarity(p_inv_norm, p_item_norm) >= 0.30
           and not (p_inv_emb is not null and p_item_emb is not null
                    and (1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) < 0.818)
        then 0.5::real + 0.5::real * strict_word_similarity(p_inv_norm, p_item_norm)
      else strict_word_similarity(p_inv_norm, p_item_norm)
    end,
    -- sinónimos
    case when p_inv_busqueda is null then 0::real else word_similarity(p_item_norm, p_inv_busqueda) end,
    -- semántico calibrado para mistral-embed: sem = (cos - 0.80) / 0.12, bono ONU solo con sem >= 0.60
    case
      when p_inv_emb is null or p_item_emb is null then 0::real
      when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
           and least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real)) >= 0.60
        then 0.5::real + 0.5::real * least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
      else least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
    end) end;
$$;
