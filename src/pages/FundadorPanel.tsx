import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Rocket,
  Users,
  ShoppingBag,
  DollarSign,
  Building2,
  Bell,
  TrendingUp,
  ArrowRight,
  Loader2,
} from "lucide-react";

const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

interface Metricas {
  denegado?: boolean;
  leads_total: number;
  leads_pendientes: number;
  compras_confirmadas: number;
  ingresos_confirmados: number;
  checkouts_pendientes: number;
  clientes_total: number;
  clientes_activos: number;
  clientes_nuevos_30d: number;
  instituciones_seguidas: number;
  avisos_30d: number;
}

const CLP = (v: number) => "$" + Math.round(v || 0).toLocaleString("es-CL");
const N = (v: number) => Number(v || 0).toLocaleString("es-CL");

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-firmavb-blue" /> {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function FundadorPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["fundador-metricas"],
    queryFn: async (): Promise<Metricas> => {
      const { data, error } = await sb.rpc("fundador_metricas");
      if (error) throw error;
      return (data ?? {}) as Metricas;
    },
    refetchInterval: 120000,
  });

  const accesos = [
    { title: "Contactos", desc: "Leads del formulario Academia", url: "/academia/leads", icon: Users },
    { title: "Compradores", desc: "Quiénes compraron los cursos", url: "/academia/compradores", icon: ShoppingBag },
    { title: "Tracción", desc: "Métricas de crecimiento", url: "/admin/traccion", icon: TrendingUp },
    { title: "Marketing", desc: "Centro de control de campañas", url: "/marketing/control", icon: Rocket },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <Rocket className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundador — Resumen</h1>
          <p className="text-sm text-muted-foreground">
            La foto del negocio: clientes, ventas de la Academia, contactos y actividad.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas…
        </div>
      ) : data?.denegado ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Esta vista es solo para el fundador.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Clientes */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Clientes</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Kpi icon={Users} label="Clientes registrados" value={N(data!.clientes_total)} />
              <Kpi icon={Users} label="Activos" value={N(data!.clientes_activos)} />
              <Kpi icon={TrendingUp} label="Nuevos (30 días)" value={N(data!.clientes_nuevos_30d)} />
            </div>
          </div>

          {/* Academia */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Academia</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Kpi icon={ShoppingBag} label="Compras confirmadas" value={N(data!.compras_confirmadas)} />
              <Kpi icon={DollarSign} label="Ingresos" value={CLP(data!.ingresos_confirmados)} />
              <Kpi icon={ShoppingBag} label="Checkouts pendientes" value={N(data!.checkouts_pendientes)} />
              <Kpi icon={Users} label="Contactos" value={N(data!.leads_total)} sub={`${N(data!.leads_pendientes)} por contactar`} />
            </div>
          </div>

          {/* Actividad */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Actividad</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Kpi icon={Building2} label="Instituciones seguidas" value={N(data!.instituciones_seguidas)} />
              <Kpi icon={Bell} label="Avisos enviados (30 días)" value={N(data!.avisos_30d)} />
            </div>
          </div>
        </>
      )}

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Gestión</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accesos.map((a) => (
            <Link key={a.url} to={a.url}>
              <Card className="border-border/50 transition-colors hover:border-firmavb-blue/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="h-9 w-9 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
                    <a.icon className="h-4 w-4 text-firmavb-blue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
