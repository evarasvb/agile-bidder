import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Shared formatters ───

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompact = (value: number) => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CL").format(value);

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// ─── CSV Export ───

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Chart colors ───

export const CHART_COLORS = [
  "hsl(var(--firmavb-blue))",
  "hsl(var(--firmavb-green))",
  "hsl(var(--firmavb-amber))",
  "hsl(var(--firmavb-red))",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

// ─── Mercado ───

export interface MercadoReport {
  kpis: {
    totalOportunidades: number;
    valorTotal: number;
    totalLicitaciones: number;
    totalCompras: number;
    valorLicitaciones: number;
    valorCompras: number;
    valorOrdenes: number;
  };
  porRegion: { region: string; count: number; monto: number }[];
  porTipo: { tipo: string; count: number; monto: number }[];
  tendenciaMensual: { mes: string; count: number; monto: number }[];
}

export function useMercadoReport() {
  return useQuery({
    queryKey: ["reportes", "mercado"],
    queryFn: async (): Promise<MercadoReport> => {
      // Agregación EN EL SERVIDOR (RPC bi_mercado_stats). Antes el hook bajaba
      // 130k+ licitaciones y 79k compras al navegador: el tope de 1.000 filas de
      // la API subcontaba las licitaciones (~1.000 en vez de 130.665) y se leía
      // compras_agiles.monto (columna inexistente → error tragado → compras=0).
      const { data, error } = await (supabase as any).rpc("bi_mercado_stats");
      if (error) throw error;
      return data as MercadoReport;
    },
  });
}

