import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Radar, Sparkles, Package } from "lucide-react";

interface LandingStats {
  oportunidades_monitoreadas: number;
  matches_encontrados_ia: number;
  productos_en_inventario: number;
}

function useLandingStats() {
  return useQuery({
    queryKey: ["public-landing-stats"],
    queryFn: async (): Promise<LandingStats> => {
      // No está en los tipos generados (RPC nueva, ver migración
      // public_landing_stats) => any, mismo patrón que el resto del código.
      const { data, error } = await (supabase as any).rpc("public_landing_stats");
      if (error) throw error;
      return data as unknown as LandingStats;
    },
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });
}

function formatMiles(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

// Prueba social con datos reales (no testimonios inventados, ver auditoría de
// marketing): en vez de logos de clientes o citas ficticias, mostramos la
// escala real de lo que la plataforma ya monitorea y calcula.
export function EstadisticasReales() {
  const { data, isLoading, isError } = useLandingStats();

  if (isError) return null; // Degradación silenciosa: mejor sin sección que una rota.

  const items = [
    {
      icon: Radar,
      value: data?.oportunidades_monitoreadas,
      label: "licitaciones y compras ágiles monitoreadas",
    },
    {
      icon: Sparkles,
      value: data?.matches_encontrados_ia,
      label: "matches encontrados con IA",
    },
    {
      icon: Package,
      value: data?.productos_en_inventario,
      label: "productos analizados en inventarios",
    },
  ];

  return (
    <section className="py-8 px-6 border-y border-border/50 bg-muted/20">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <item.icon className="h-5 w-5 text-firmavb-blue" aria-hidden="true" />
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
              {isLoading || item.value == null ? "—" : `${formatMiles(item.value)}+`}
            </p>
            <p className="text-xs text-muted-foreground max-w-[16rem]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
