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

// ─── Proveedores ───

export function useProveedoresReport() {
  return useQuery({
    queryKey: ["reportes", "proveedores"],
    queryFn: async () => {
      const { data: adjudicaciones, error } = await supabase
        .from("licitaciones_adjudicaciones")
        .select("proveedor_nombre, proveedor_rut, monto_adjudicado, fecha_adjudicacion, licitacion_id")
        .not("proveedor_nombre", "is", null);

      if (error) throw error;
      if (!adjudicaciones?.length) return [];

      // Group by provider
      const provMap = new Map<
        string,
        {
          nombre: string;
          rut: string;
          montoTotal: number;
          adjudicaciones: number;
          fechas: string[];
        }
      >();

      for (const adj of adjudicaciones) {
        const key = adj.proveedor_rut || adj.proveedor_nombre || "unknown";
        const existing = provMap.get(key);
        if (existing) {
          existing.montoTotal += adj.monto_adjudicado || 0;
          existing.adjudicaciones += 1;
          if (adj.fecha_adjudicacion) existing.fechas.push(adj.fecha_adjudicacion);
        } else {
          provMap.set(key, {
            nombre: adj.proveedor_nombre || "Sin nombre",
            rut: adj.proveedor_rut || "—",
            montoTotal: adj.monto_adjudicado || 0,
            adjudicaciones: 1,
            fechas: adj.fecha_adjudicacion ? [adj.fecha_adjudicacion] : [],
          });
        }
      }

      const totalMercado = Array.from(provMap.values()).reduce(
        (sum, p) => sum + p.montoTotal,
        0
      );

      return Array.from(provMap.values())
        .map((p) => ({
          ...p,
          participacion: totalMercado > 0 ? (p.montoTotal / totalMercado) * 100 : 0,
        }))
        .sort((a, b) => b.montoTotal - a.montoTotal);
    },
  });
}

// ─── Productos ───

export function useProductosReport() {
  return useQuery({
    queryKey: ["reportes", "productos"],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("compras_agiles_items")
        .select("nombre_producto, categoria, cantidad, precio_unitario, total, created_at");

      if (error) throw error;
      if (!items?.length) return [];

      const prodMap = new Map<
        string,
        {
          nombre: string;
          categoria: string;
          cantidadTotal: number;
          montoTotal: number;
          precios: number[];
          compras: number;
        }
      >();

      for (const item of items) {
        const key = item.nombre_producto.toLowerCase().trim();
        const existing = prodMap.get(key);
        const precio = item.precio_unitario || 0;
        if (existing) {
          existing.cantidadTotal += item.cantidad || 0;
          existing.montoTotal += item.total || 0;
          if (precio > 0) existing.precios.push(precio);
          existing.compras += 1;
        } else {
          prodMap.set(key, {
            nombre: item.nombre_producto,
            categoria: item.categoria || "Sin categoría",
            cantidadTotal: item.cantidad || 0,
            montoTotal: item.total || 0,
            precios: precio > 0 ? [precio] : [],
            compras: 1,
          });
        }
      }

      return Array.from(prodMap.values())
        .map((p) => ({
          ...p,
          precioPromedio:
            p.precios.length > 0
              ? p.precios.reduce((a, b) => a + b, 0) / p.precios.length
              : 0,
          precioMin: p.precios.length > 0 ? Math.min(...p.precios) : 0,
          precioMax: p.precios.length > 0 ? Math.max(...p.precios) : 0,
        }))
        .sort((a, b) => b.montoTotal - a.montoTotal);
    },
  });
}

// ─── Compradores ───

export function useCompradoresReport() {
  return useQuery({
    queryKey: ["reportes", "compradores"],
    queryFn: async () => {
      const [instResult, conductaResult] = await Promise.all([
        supabase
          .from("instituciones")
          .select("id, nombre, rut, tipo, region, monto_total_compras, total_licitaciones, total_ordenes"),
        supabase.from("conducta_pago").select("institucion_id, score_pago, promedio_dias_pago"),
      ]);

      if (instResult.error) throw instResult.error;
      if (!instResult.data?.length) return [];

      const conductaMap = new Map<string, { score: number | null; dias: number | null }>();
      if (conductaResult.data) {
        for (const c of conductaResult.data) {
          if (c.institucion_id) {
            conductaMap.set(c.institucion_id, {
              score: c.score_pago,
              dias: c.promedio_dias_pago,
            });
          }
        }
      }

      return instResult.data
        .map((inst) => {
          const conducta = conductaMap.get(inst.id);
          return {
            id: inst.id,
            nombre: inst.nombre,
            rut: inst.rut,
            tipo: inst.tipo || "Otro",
            region: inst.region || "—",
            montoTotal: inst.monto_total_compras || 0,
            totalLicitaciones: inst.total_licitaciones || 0,
            totalOrdenes: inst.total_ordenes || 0,
            scorePago: conducta?.score ?? null,
            promedioDiasPago: conducta?.dias ?? null,
          };
        })
        .sort((a, b) => b.montoTotal - a.montoTotal);
    },
  });
}

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

// ─── Competidores ───

export function useCompetidoresReport() {
  return useQuery({
    queryKey: ["reportes", "competidores"],
    queryFn: async () => {
      const { data: adjudicaciones, error } = await supabase
        .from("licitaciones_adjudicaciones")
        .select("proveedor_nombre, proveedor_rut, monto_adjudicado, licitacion_id")
        .not("proveedor_nombre", "is", null);

      if (error) throw error;
      if (!adjudicaciones?.length) return [];

      // Group by competitor
      const compMap = new Map<
        string,
        {
          nombre: string;
          rut: string;
          totalAdjudicado: number;
          licitacionesGanadas: number;
          licitacionIds: Set<string>;
        }
      >();

      for (const adj of adjudicaciones) {
        const key = adj.proveedor_rut || adj.proveedor_nombre || "unknown";
        const existing = compMap.get(key);
        if (existing) {
          existing.totalAdjudicado += adj.monto_adjudicado || 0;
          existing.licitacionesGanadas += 1;
          existing.licitacionIds.add(adj.licitacion_id);
        } else {
          compMap.set(key, {
            nombre: adj.proveedor_nombre || "Sin nombre",
            rut: adj.proveedor_rut || "—",
            totalAdjudicado: adj.monto_adjudicado || 0,
            licitacionesGanadas: 1,
            licitacionIds: new Set([adj.licitacion_id]),
          });
        }
      }

      const totalMercado = Array.from(compMap.values()).reduce(
        (sum, c) => sum + c.totalAdjudicado,
        0
      );

      return Array.from(compMap.values())
        .map((c) => ({
          nombre: c.nombre,
          rut: c.rut,
          totalAdjudicado: c.totalAdjudicado,
          licitacionesGanadas: c.licitacionesGanadas,
          licitacionesUnicas: c.licitacionIds.size,
          participacion: totalMercado > 0 ? (c.totalAdjudicado / totalMercado) * 100 : 0,
        }))
        .sort((a, b) => b.totalAdjudicado - a.totalAdjudicado);
    },
  });
}

// ─── Convenio Marco ───

export function useConvenioMarcoReport() {
  return useQuery({
    queryKey: ["reportes", "convenio-marco"],
    queryFn: async () => {
      // Query ordenes_compra that are from convenio marco (type = "CM" or similar)
      const { data: ordenes, error } = await supabase
        .from("ordenes_compra")
        .select("id, codigo, nombre, tipo, total, estado, fecha_creacion, proveedor_nombre, institucion_nombre")
        .or("tipo.ilike.%convenio%,tipo.ilike.%CM%,tipo.eq.SE")
        .limit(500);

      if (error) throw error;
      if (!ordenes?.length) return [];

      return ordenes.map((o) => ({
        codigo: o.codigo,
        nombre: o.nombre,
        tipo: o.tipo || "—",
        total: o.total || 0,
        estado: o.estado || "—",
        fechaCreacion: o.fecha_creacion,
        proveedor: o.proveedor_nombre || "—",
        institucion: o.institucion_nombre || "—",
      }));
    },
  });
}
