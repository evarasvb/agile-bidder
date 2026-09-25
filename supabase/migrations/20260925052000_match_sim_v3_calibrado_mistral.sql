-- Recalibración de match_sim_v3 para mistral-embed (1024 d), 25-09-2026, con 3.600 ítems de
-- compras ágiles y 16.400 productos vectorizados:
--   pares al azar: mediana 0.70, p90 0.74, p99 0.765, máximo 0.82  (con Gemini el piso era 0.53-0.60)
--   mejor producto por ítem: >= 0.85 es el mismo producto (corchetera/corchetes 0.89, cinta
--   enmascarar 0.91, set acrílicos 0.87); 0.80-0.85 mezcla familia y ruido; < 0.80 ruido.
-- Mapeo: sem = (cos - 0.80) / 0.12 acotado a [0,1]  (0.836->0.30, 0.85->0.42, 0.89->0.75, 0.92->1).
-- El máximo de pares al azar (0.82) queda en 0.17, bajo el umbral de ítem (0.30).
create or replace function public.match_sim_v3(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_inv_emb extensions.vector,
  p_item_norm text, p_item_cod text, p_item_emb extensions.vector)
returns real language sql immutable as $$
  select greatest(
    public.match_sim(p_inv_norm, p_inv_busqueda, p_inv_cod, p_item_norm, p_item_cod),
    case
      when p_inv_emb is null or p_item_emb is null then 0::real
      when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
           and least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real)) >= 0.30
        then 0.5::real + 0.5::real * least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
      else least(1::real, greatest(0::real, (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.80) / 0.12)::real))
    end);
$$;

-- Los matches por ítem calculados con la calibración de Gemini se borran y se regeneran
-- (los crones match-ca-items-horario y match-lic-items-cliente-horario los rehacen completos).
delete from public.ca_item_matches m using public.compras_agiles c
  where c.codigo = m.compra_agil_codigo and c.fecha_cierre > now();
delete from public.lic_item_matches m using public.licitaciones_bi l
  where l.codigo = m.licitacion_codigo and l.fecha_cierre > now();
