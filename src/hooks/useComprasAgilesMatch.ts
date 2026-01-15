import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem } from "@/hooks/useInventory";
import type { CompraAgil } from "@/hooks/useComprasAgiles";

export interface CompraAgilMatch extends CompraAgil {
  match_score_inventario: number;
  matched_terms: string[];
}

interface ComprasAgilesMatchResult {
  countsByProductId: Record<string, number>;
  matchesByProductId: Record<string, CompraAgilMatch[]>;
  totalAbiertas: number;
}

const STOP_WORDS = new Set([
  "de",
  "la",
  "las",
  "los",
  "el",
  "un",
  "una",
  "unos",
  "unas",
  "para",
  "por",
  "con",
  "sin",
  "sobre",
  "del",
  "al",
  "y",
  "o",
  "u",
  "en",
  "a",
  "e",
  "que",
  "se",
  "su",
  "sus",
]);

const CLOSED_STATES = new Set(["cerrada", "adjudicada", "desierta", "cancelada"]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function getProductTokens(item: InventoryItem): string[] {
  const tokens = new Set<string>();

  if (Array.isArray(item.keywords)) {
    item.keywords.forEach((keyword) => {
      tokenize(keyword).forEach((token) => tokens.add(token));
    });
  }

  [item.nombre_producto, item.descripcion || "", item.categoria || ""].forEach((value) => {
    tokenize(value).forEach((token) => tokens.add(token));
  });

  return Array.from(tokens);
}

function isCompraAbierta(compra: CompraAgil): boolean {
  const estado = compra.estado?.toLowerCase().trim();
  if (estado && CLOSED_STATES.has(estado)) return false;

  if (compra.fecha_cierre) {
    const cierre = new Date(compra.fecha_cierre);
    if (!Number.isNaN(cierre.getTime())) {
      return cierre.getTime() >= Date.now();
    }
  }

  return true;
}

function getCompraSearchText(compra: CompraAgil): string {
  return normalizeText(
    [compra.nombre, compra.descripcion || "", compra.organismo || "", compra.region || ""].join(" ")
  );
}

export function useComprasAgilesMatch(
  inventario: InventoryItem[] = []
): ComprasAgilesMatchResult & { isLoading: boolean } {
  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras_agiles", "abiertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_agiles")
        .select(
          "id,codigo,nombre,organismo,monto,fecha_cierre,estado,region,descripcion,link_oficial,match_encontrado,match_score,datos_json"
        )
        .order("fecha_cierre", { ascending: true });

      if (error) throw error;
      return data as CompraAgil[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const computed = useMemo<ComprasAgilesMatchResult>(() => {
    const abiertas = (compras || []).filter(isCompraAbierta);
    const normalizedCompras = abiertas.map((compra) => ({
      compra,
      text: getCompraSearchText(compra),
    }));

    const countsByProductId: Record<string, number> = {};
    const matchesByProductId: Record<string, CompraAgilMatch[]> = {};

    inventario.forEach((item) => {
      if (!item.activo) {
        countsByProductId[item.id] = 0;
        matchesByProductId[item.id] = [];
        return;
      }

      const tokens = getProductTokens(item);
      if (tokens.length === 0) {
        countsByProductId[item.id] = 0;
        matchesByProductId[item.id] = [];
        return;
      }

      const matches: CompraAgilMatch[] = [];

      normalizedCompras.forEach(({ compra, text }) => {
        const matchedTerms = tokens.filter((token) => text.includes(token));
        if (matchedTerms.length === 0) return;

        const score = Math.min(100, Math.round((matchedTerms.length / tokens.length) * 100));
        matches.push({
          ...compra,
          match_score_inventario: score,
          matched_terms: matchedTerms,
        });
      });

      matches.sort((a, b) => b.match_score_inventario - a.match_score_inventario);
      matchesByProductId[item.id] = matches;
      countsByProductId[item.id] = matches.length;
    });

    return {
      countsByProductId,
      matchesByProductId,
      totalAbiertas: normalizedCompras.length,
    };
  }, [compras, inventario]);

  return {
    ...computed,
    isLoading,
  };
}
