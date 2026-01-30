import { useMemo } from "react";
import { useLicitaciones, type Licitacion } from "@/hooks/useLicitaciones";
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

const isLicitacionAbierta = (licitacion: Licitacion) => {
  if (!licitacion.estado) return true;
  return !CLOSED_STATES.has(licitacion.estado.toLowerCase());
};

const matchesKeywords = (licitacion: Licitacion, keywords: string[]) => {
  if (keywords.length === 0) return false;
  const haystack = normalizeText(
    [licitacion.titulo, licitacion.descripcion, licitacion.organismo].filter(Boolean).join(" ")
  );
  if (!haystack) return false;
  return keywords.some((keyword) => haystack.includes(keyword));
};

export function useLicitacionesMatch(inventario?: InventoryItem[]) {
  const licitacionesQuery = useLicitaciones();

  const licitacionesAbiertas = useMemo(
    () => (licitacionesQuery.data ?? []).filter(isLicitacionAbierta),
    [licitacionesQuery.data]
  );

  const { matchesByProductId, countsByProductId } = useMemo(() => {
    const matches: Record<string, Licitacion[]> = {};
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

      const matchedlicitaciones = licitacionesAbiertas.filter((compra) =>
        matchesKeywords(compra, keywords)
      );
      matches[item.id] = matchedlicitaciones;
      counts[item.id] = matchedlicitaciones.length;
    }

    return { matchesByProductId: matches, countsByProductId: counts };
  }, [licitacionesAbiertas, inventario]);

  return {
    licitacionesAbiertas,
    matchesByProductId,
    countsByProductId,
    isLoading: licitacionesQuery.isLoading,
    isFetching: licitacionesQuery.isFetching,
    error: licitacionesQuery.error,
  };
}
