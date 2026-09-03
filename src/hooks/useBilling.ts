import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export interface VentaComisionable {
  id: string;
  codigo_oc: string;
  fecha_aceptacion: string | null;
  comprador: string | null;
  monto_neto: number;
  comision_monto: number;
  periodo: string;
}

export interface FacturaComision {
  id: string;
  numero_factura: string;
  periodo: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  total_ventas: number;
  total_comision: number;
  fijo_monto?: number;
  total?: number;
  estado: string;
  fecha_pago: string | null;
  documento_url: string | null;
  validacion_hasta?: string | null;
  detalle?: { ocs?: { oc: string; licitacion: string; comprador: string; fecha: string; neto: number; comision: number }[]; n?: number } | null;
}

export interface EmpresaBilling {
  id: string;
  nombre_empresa: string | null;
  plan: string;
  comision_porcentaje: number;
  tarjeta_ultimos_4: string | null;
  tarjeta_marca: string | null;
  tarjeta_expiracion: string | null;
}

export interface BillingStats {
  ventasMesActual: number;
  comisionMesActual: number;
  ocProcesadas: number;
  saldoPendiente: number;
}

export interface MonthlyData {
  mes: string;
  ventas: number;
  comisiones: number;
}

export function useBillingStats() {
  const { user } = useAuth();
  const currentPeriod = format(new Date(), "yyyy-MM");

  return useQuery({
    queryKey: ["billing-stats", user?.id, currentPeriod],
    queryFn: async (): Promise<BillingStats> => {
      if (!user?.id) throw new Error("No user");

      // Get current month sales
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas_comisionables")
        .select("monto_neto, comision_monto")
        .eq("user_id", user.id)
        .eq("periodo", currentPeriod);

      if (ventasError) throw ventasError;

      const ventasMesActual = ventas?.reduce((sum, v) => sum + Number(v.monto_neto), 0) || 0;
      const comisionMesActual = ventas?.reduce((sum, v) => sum + Number(v.comision_monto), 0) || 0;
      const ocProcesadas = ventas?.length || 0;

      // Get pending invoices total
      const { data: facturasPendientes, error: facturasError } = await supabase
        .from("facturas_comision")
        .select("total_comision")
        .eq("user_id", user.id)
        .eq("estado", "pendiente");

      if (facturasError) throw facturasError;

      const saldoPendiente = facturasPendientes?.reduce((sum, f) => sum + Number(f.total_comision), 0) || 0;

      return {
        ventasMesActual,
        comisionMesActual,
        ocProcesadas,
        saldoPendiente,
      };
    },
    enabled: !!user?.id,
  });
}

export function useMonthlyBillingData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["billing-monthly", user?.id],
    queryFn: async (): Promise<MonthlyData[]> => {
      if (!user?.id) throw new Error("No user");

      const months: MonthlyData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const periodo = format(date, "yyyy-MM");
        const mesLabel = format(date, "MMM");

        const { data, error } = await supabase
          .from("ventas_comisionables")
          .select("monto_neto, comision_monto")
          .eq("user_id", user.id)
          .eq("periodo", periodo);

        if (error) throw error;

        const ventas = data?.reduce((sum, v) => sum + Number(v.monto_neto), 0) || 0;
        const comisiones = data?.reduce((sum, v) => sum + Number(v.comision_monto), 0) || 0;

        months.push({ mes: mesLabel, ventas, comisiones });
      }

      return months;
    },
    enabled: !!user?.id,
  });
}

export function useCurrentMonthSales(searchTerm: string = "", dateFilter?: { start: Date; end: Date }) {
  const { user } = useAuth();
  const currentPeriod = format(new Date(), "yyyy-MM");

  return useQuery({
    queryKey: ["billing-sales", user?.id, currentPeriod, searchTerm, dateFilter],
    queryFn: async (): Promise<VentaComisionable[]> => {
      if (!user?.id) throw new Error("No user");

      let query = supabase
        .from("ventas_comisionables")
        .select("*")
        .eq("user_id", user.id)
        .eq("periodo", currentPeriod)
        .order("fecha_aceptacion", { ascending: false });

      if (searchTerm) {
        query = query.or(`codigo_oc.ilike.%${searchTerm}%,comprador.ilike.%${searchTerm}%`);
      }

      if (dateFilter?.start) {
        query = query.gte("fecha_aceptacion", dateFilter.start.toISOString());
      }
      if (dateFilter?.end) {
        query = query.lte("fecha_aceptacion", dateFilter.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useInvoiceHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["billing-invoices", user?.id],
    queryFn: async (): Promise<FacturaComision[]> => {
      if (!user?.id) throw new Error("No user");

      const { data, error } = await supabase
        .from("facturas_comision")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha_emision", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useBillingSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["billing-settings", user?.id],
    queryFn: async (): Promise<EmpresaBilling | null> => {
      if (!user?.id) throw new Error("No user");

      const { data, error } = await supabase
        .from("empresas_billing")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
