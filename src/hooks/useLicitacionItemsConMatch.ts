import { useMemo } from 'react';
import { useProductMatching, type ItemConMatch } from './useProductMatching';
import type { ItemRequerido } from '@/services/fuzzyMatching';
import { useLicItemMatches } from './useLicItemMatches';
import { useInventoryActivo, type InventoryItem } from './useInventory';

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
  const { procesarCompra, isLoading } = useProductMatching();
  const { data: dbMatches = [] } = useLicItemMatches(codigo);
  const { data: inventarioActivo = [] } = useInventoryActivo();

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
      if (!dbRow || !dbRow.inventario_id) return item;
      // Producto vivo del inventario si sigue activo; si se desactivó desde que
      // se calculó el match, se arma uno mínimo con lo que quedó guardado en
      // lic_item_matches (nombre/sku/precio de ese momento) para no perder el
      // match por completo.
      const inventoryItem: InventoryItem =
        inventarioById.get(dbRow.inventario_id) ?? ({
          id: dbRow.inventario_id,
          sku: dbRow.sku || '',
          nombre_producto: dbRow.nombre_producto || '',
          descripcion: null,
          categoria: null,
          keywords: null,
          precio_unitario: dbRow.precio_unitario || 0,
          margen_minimo: null,
          margen_objetivo: null,
          stock_disponible: null,
          unidad_medida: null,
          marca: null,
          tiempo_entrega_dias: null,
          proveedor: null,
          activo: null,
          imagen_url: null,
          cliente_id: '',
          created_at: '',
          updated_at: '',
        } as InventoryItem);
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
