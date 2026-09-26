import { useMemo } from 'react';
import { useProductMatching, type ItemConMatch } from './useProductMatching';
import type { ItemRequerido } from '@/services/fuzzyMatching';
import { useLicItemMatches } from './useLicItemMatches';
import { useInventoryActivo, type InventoryItem } from './useInventory';

// Mismo umbral que usa OportunidadDetalle.tsx para considerar visible un match
// de lic_item_matches (score >= 40). El generador guarda filas desde 30, así
// que sin este filtro acá se podía auto-seleccionar y cotizar un producto que
// en el detalle de la oportunidad se ve como "Sin match".
const UMBRAL_MATCH_VISIBLE = 40;

// Combina el match "bueno" calculado en el servidor (lic_item_matches: sinónimos,
// código ONU, semántica) con el motor fuzzy del navegador (useProductMatching)
// como respaldo. Es necesario un respaldo porque generar_matches_lic_items_cliente
// solo corre sobre licitaciones_bi_items — las licitaciones cuyos ítems todavía
// viven en la tabla legacy `licitacion_items` (la mayoría de las históricas) nunca
// tienen fila en lic_item_matches.
//
// Antes "Productos Solicitados" (LicitacionItemsMatch) y "Generar Cotización"
// (LibroLicitacion) calculaban el match cada uno por su cuenta con el motor fuzzy,
// sin usar nunca lic_item_matches: un producto que aparecía emparejado en el
// detalle de la oportunidad podía salir distinto o directamente sin match al
// pasar a armar la cotización. Ambas pantallas deben usar este mismo hook para
// que el match no cambie de una a otra.
export function useLicitacionItemsConMatch(
  codigo: string | null | undefined,
  items: ItemRequerido[],
): { itemsConMatch: ItemConMatch[]; isLoading: boolean } {
  const { procesarCompra, isLoading: isLoadingFuzzy } = useProductMatching();
  // Mientras esta consulta todavía está en curso, dbMatches queda en [] por el
  // valor por defecto — indistinguible de "sin match en el servidor". Sin su
  // isLoading acá, se exponía el resultado fuzzy como si fuera definitivo un
  // instante antes de que llegara el de verdad, recreando el mismo bug que
  // este hook vino a cerrar (hallazgo de Codex en esta misma PR).
  const { data: dbMatches = [], isLoading: isLoadingDb } = useLicItemMatches(codigo);
  const { data: inventarioActivo = [] } = useInventoryActivo();
  const isLoading = isLoadingFuzzy || isLoadingDb;

  const inventarioById = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    (inventarioActivo as InventoryItem[]).forEach((p) => m.set(p.id, p));
    return m;
  }, [inventarioActivo]);

  const dbByItemId = useMemo(() => {
    const m = new Map<string, (typeof dbMatches)[number]>();
    dbMatches.forEach((row) => m.set(row.item_id, row));
    return m;
  }, [dbMatches]);

  const itemsConMatch = useMemo(() => {
    if (!items.length) return [];
    const fuzzy = procesarCompra(items);
    return fuzzy.map((item): ItemConMatch => {
      const dbRow = dbByItemId.get(item.id);
      if (!dbRow || !dbRow.inventario_id || Number(dbRow.score) < UMBRAL_MATCH_VISIBLE) return item;
      // cliente_inventario no tiene columna "activo" (useInventoryActivo trae
      // TODOS los productos del cliente); si el id no aparece ahí es porque el
      // producto se borró de verdad. Mostrar ese SKU/precio viejo dejaría
      // cotizar algo que ya no existe, así que se cae al resultado fuzzy (o sin
      // match) en vez de fabricar el producto desde la foto vieja del cron.
      const inventoryItem = inventarioById.get(dbRow.inventario_id);
      if (!inventoryItem) return item;
      return {
        ...item,
        bestMatch: {
          inventoryItem,
          score: Number(dbRow.score) || 0,
          matchType: 'exact',
          matchedTerms: [],
        },
      };
    });
  }, [items, procesarCompra, dbByItemId, inventarioById]);

  return { itemsConMatch, isLoading };
}
