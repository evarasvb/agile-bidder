import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tras cualquier cambio de inventario, re-dispara el match de compras ágiles del
// cliente (RPC security-definer que resuelve el cliente por auth.uid()) y refresca
// las vistas de oportunidades. Así el cliente NO tiene que esperar al cron horario
// para ver oportunidades nuevas después de cargar o editar sus productos.
//
// Es fire-and-forget seguro: si la RPC falla, el cron igual recalcula más tarde.
export async function recalcularMatchInventario(queryClient?: QueryClient) {
  try {
    await (supabase as any).rpc("generar_matches_ca_para_mi");
  } catch (e) {
    // Silencioso a propósito: no bloquea la carga de inventario.
    console.warn("[recalcularMatchInventario] no se pudo recalcular ahora:", e);
  }
  if (!queryClient) return;
  for (const key of [
    ["compras_agiles_match"],
    ["oportunidades-panel"],
    ["oportunidad-detalle"],
    ["oportunidades"],
    ["ca-item-matches"],
    ["dashboard-principal"],
  ]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
