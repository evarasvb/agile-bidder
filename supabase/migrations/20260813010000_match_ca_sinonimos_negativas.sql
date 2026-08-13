-- Mejora del match de compras ágiles inspirada en el onboarding de la competencia
-- (Licitabien): usar SINÓNIMOS del producto y aplicar FRASES NEGATIVAS con puntaje.
--
-- 1) SINÓNIMOS: cliente_inventario.palabras_clave ya está poblado (~32.500 de
--    32.700 productos) pero el match lo IGNORABA: sólo comparaba contra
--    nombre_producto. Ahora comparamos contra un campo `busqueda_match` que
--    concatena nombre + sinónimos, con su propio índice GIN de trigramas para
--    que siga siendo rápido incluso con clientes de 16.000 productos.
--    (ej: la compra "cartucho de tinta" ahora matchea el producto "Tóner HP"
--     si tiene "cartucho de tinta" entre sus palabras_clave).
--
-- 2) FRASES NEGATIVAS (client_negative_keywords, por perfil de búsqueda):
--    - Si la frase aparece en el TÍTULO o DESCRIPCIÓN de la compra => se EXCLUYE.
--    - Si aparece sólo en el PRODUCTO/ítem => se PENALIZA el puntaje (x0.5).
--    Cuando el cliente no tiene frases negativas, todo esto es no-op.

-- ── Campo de búsqueda concatenado (nombre + sinónimos) + índice trigram ──────
alter table public.cliente_inventario
  add column if not exists busqueda_match text;

update public.cliente_inventario
set busqueda_match = lower(coalesce(nombre_producto, '') || ' ' ||
                          coalesce(array_to_string(palabras_clave, ' '), ''))
where busqueda_match is null;

create index if not exists idx_inv_busqueda_trgm
  on public.cliente_inventario using gin (busqueda_match gin_trgm_ops);

-- Mantener busqueda_match al día cuando cambian nombre o sinónimos.
create or replace function public.cliente_inventario_set_busqueda()
returns trigger language plpgsql as $$
begin
  new.busqueda_match := lower(coalesce(new.nombre_producto, '') || ' ' ||
                              coalesce(array_to_string(new.palabras_clave, ' '), ''));
  return new;
end $$;

drop trigger if exists trg_cliente_inventario_busqueda on public.cliente_inventario;
create trigger trg_cliente_inventario_busqueda
before insert or update of nombre_producto, palabras_clave on public.cliente_inventario
for each row execute function public.cliente_inventario_set_busqueda();

-- ── Función de match ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_matches_ca(p_cliente uuid, p_umbral real DEFAULT 0.30)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  n integer;
  neg text[];
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);

  -- Frases negativas del cliente (a través de sus perfiles de búsqueda).
  neg := ARRAY(
    SELECT DISTINCT lower(trim(k.keyword))
    FROM public.client_negative_keywords k
    JOIN public.client_search_profiles pr ON pr.id = k.profile_id
    WHERE pr.client_id = p_cliente AND coalesce(trim(k.keyword), '') <> ''
  );

  INSERT INTO public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  SELECT b.codigo, p_cliente, b.inv_id,
         round((b.sim * 100 * b.factor)::numeric, 1),
         (b.sim * b.factor) >= 0.55,
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  FROM (
    SELECT DISTINCT ON (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id AS inv_id, m.nombre_producto,
           m.precio_unitario, m.sim,
           CASE WHEN t.item_neg THEN 0.5 ELSE 1 END AS factor
    FROM (
      -- 1) Producto por producto cuando la compra tiene ítems
      SELECT ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_producto AS texto,
             (cardinality(neg) > 0 AND EXISTS (
               SELECT 1 FROM unnest(neg) g
               WHERE position(g IN lower(coalesce(ca.nombre, '') || ' ' || coalesce(ca.descripcion, ''))) > 0
             )) AS titulo_neg,
             (cardinality(neg) > 0 AND EXISTS (
               SELECT 1 FROM unnest(neg) g
               WHERE position(g IN lower(coalesce(i.nombre_producto, ''))) > 0
             )) AS item_neg
      FROM public.compras_agiles ca
      JOIN public.compras_agiles_items i ON i.compra_agil_id = ca.id
      WHERE ca.fecha_cierre >= now() AND ca.estado ILIKE 'publicada'
        AND i.nombre_producto IS NOT NULL
      UNION ALL
      -- 2) Título normalizado cuando NO hay ítems
      SELECT ca.codigo, ca.nombre, ca.fecha_cierre,
             nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               upper(ca.nombre), '\([^)]*\)', ' ', 'g'),
               '[0-9]{2,}[-–][0-9–-]{3,}', ' ', 'g'),
               '[[:space:]]+', ' ', 'g')), '') AS texto,
             (cardinality(neg) > 0 AND EXISTS (
               SELECT 1 FROM unnest(neg) g
               WHERE position(g IN lower(coalesce(ca.nombre, '') || ' ' || coalesce(ca.descripcion, ''))) > 0
             )) AS titulo_neg,
             false AS item_neg
      FROM public.compras_agiles ca
      WHERE ca.fecha_cierre >= now() AND ca.estado ILIKE 'publicada' AND ca.nombre IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.compras_agiles_items i WHERE i.compra_agil_id = ca.id)
    ) t
    CROSS JOIN LATERAL (
      -- Mejor coincidencia del inventario del cliente contra nombre + sinónimos
      -- (campo busqueda_match, con índice GIN de trigramas). Devuelve el nombre
      -- real del producto para mostrar, pero puntúa sobre el texto ampliado.
      SELECT ci.id, ci.nombre_producto, ci.precio_unitario,
             -- OJO con la dirección: busqueda_match es largo (nombre + sinónimos),
             -- así que se mide cuánto del texto de la compra está contenido en el
             -- vocabulario del producto: word_similarity(texto_compra, busqueda_match).
             word_similarity(t.texto, ci.busqueda_match) AS sim
      FROM public.cliente_inventario ci
      WHERE ci.cliente_id = p_cliente AND t.texto IS NOT NULL
        AND ci.busqueda_match %> t.texto
      ORDER BY ci.busqueda_match <->> t.texto
      LIMIT 1
    ) m
    WHERE NOT t.titulo_neg
    ORDER BY t.codigo, m.sim DESC
  ) b
  ON CONFLICT (compra_agil_codigo, cliente_id) DO UPDATE
    SET inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
