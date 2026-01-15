import { useMemo } from "react";
import { useComprasAgiles, type CompraAgil } from "@/hooks/useComprasAgiles";
import type { InventoryItem } from "@/hooks/useInventory";

const CLOSED_STATES = new Set(["cerrada", "adjudicada"]);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isCompraAbierta = (compra: CompraAgil) => {
  if (!compra.estado) return true;
  return !CLOSED_STATES.has(compra.estado.toLowerCase());
};

const matchesKeywords = (compra: CompraAgil, keywords: string[]) => {
  if (keywords.length === 0) return false;
  const haystack = normalizeText(
    [compra.nombre, compra.descripcion, compra.organismo].filter(Boolean).join(" ")
  );
  if (!haystack) return false;
  return keywords.some((keyword) => haystack.includes(keyword));
};

export function useComprasAgilesMatch(inventario?: InventoryItem[]) {
  const comprasQuery = useComprasAgiles();

  const comprasAbiertas = useMemo(
    () => (comprasQuery.data ?? []).filter(isCompraAbierta),
    [comprasQuery.data]
  );

  const { matchesByProductId, countsByProductId } = useMemo(() => {
    const matches: Record<string, CompraAgil[]> = {};
    const counts: Record<string, number> = {};

    if (!inventario || inventario.length === 0) {
      return { matchesByProductId: matches, countsByProductId: counts };
    }

    for (const item of inventario) {
      const keywords = Array.from(
        new Set(
          (item.keywords ?? [])
            .map((keyword) => normalizeText(keyword))
            .filter((keyword) => keyword.length >= 2)
        )
      );

      if (keywords.length === 0) {
        matches[item.id] = [];
        counts[item.id] = 0;
        continue;
      }

      const matchedCompras = comprasAbiertas.filter((compra) =>
        matchesKeywords(compra, keywords)
      );
      matches[item.id] = matchedCompras;
      counts[item.id] = matchedCompras.length;
    }

    return { matchesByProductId: matches, countsByProductId: counts };
  }, [comprasAbiertas, inventario]);

  return {
    comprasAbiertas,
    matchesByProductId,
    countsByProductId,
    isLoading: comprasQuery.isLoading,
    isFetching: comprasQuery.isFetching,
    error: comprasQuery.error,
  };
}
