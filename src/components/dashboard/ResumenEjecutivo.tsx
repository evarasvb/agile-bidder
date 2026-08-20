import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, DollarSign, Trophy, TrendingUp } from "lucide-react";
import { usePipeline } from "@/hooks/usePipeline";
import { ETAPA_CONFIG, PIPELINE_ETAPAS, type PipelineEtapa } from "@/components/pipeline/pipelineConstants";

const POSTULADAS: PipelineEtapa[] = ["postulada", "evaluacion", "adjudicada", "oc_emitida", "pagada"];
const GANADAS: PipelineEtapa[] = ["adjudicada", "oc_emitida", "pagada"];
const ACTIVAS: PipelineEtapa[] = ["preparacion", "postulada", "evaluacion"];

function clp(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n || 0);
}

/**
 * Resumen ejecutivo del negocio a partir de datos REALES del pipeline
 * (postulaciones). Reemplaza la ausencia de una vista de negocio para el
 * gerente: monto en juego, adjudicado y tasa de éxito.
 */
export function ResumenEjecutivo() {
  const { data: items = [], isLoading } = usePipeline();

  const kpi = useMemo(() => {
    const total = items.length;
    const postuladas = items.filter((i) => POSTULADAS.includes(i.etapa)).length;
    const ganadas = items.filter((i) => GANADAS.includes(i.etapa));
    const montoGanado = ganadas.reduce((s, i) => s + (i.monto_estimado || 0), 0);
    const montoEnJuego = items
      .filter((i) => ACTIVAS.includes(i.etapa))
      .reduce((s, i) => s + (i.monto_estimado || 0), 0);
    const tasa = postuladas > 0 ? Math.round((ganadas.length / postuladas) * 100) : 0;
    const porEtapa = PIPELINE_ETAPAS.map((e) => ({
      etapa: e,
      label: ETAPA_CONFIG[e].label,
      color: ETAPA_CONFIG[e].color,
      count: items.filter((i) => i.etapa === e).length,
    }));
    const maxEtapa = Math.max(1, ...porEtapa.map((p) => p.count));
    return { total, postuladas, ganadas: ganadas.length, montoGanado, montoEnJuego, tasa, porEtapa, maxEtapa };
  }, [items]);

  if (isLoading) return null;

  const cards = [
    { icon: Briefcase, label: "En tu pipeline", value: String(kpi.total), sub: `${kpi.postuladas} postuladas`, tone: "text-firmavb-blue" },
    { icon: DollarSign, label: "Monto en juego", value: clp(kpi.montoEnJuego), sub: "propuestas activas", tone: "text-[hsl(var(--warning))]" },
    { icon: Trophy, label: "Adjudicadas", value: String(kpi.ganadas), sub: clp(kpi.montoGanado), tone: "text-[hsl(var(--success))]" },
    { icon: TrendingUp, label: "Tasa de éxito", value: `${kpi.tasa}%`, sub: "adjudicadas / postuladas", tone: "text-firmavb-blue" },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Resumen del negocio</h2>
            <p className="text-sm text-muted-foreground">Tus postulaciones de un vistazo</p>
          </div>
        </div>

        {kpi.total === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aún no tienes oportunidades en tu pipeline. Cuando prepares una propuesta o agregues una oportunidad,
            aparecerá aquí tu resumen de negocio.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className={`h-4 w-4 ${c.tone}`} />
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Embudo por etapa (datos reales) */}
            <div className="mt-5 space-y-1.5">
              {kpi.porEtapa.filter((p) => p.count > 0).map((p) => (
                <div key={p.etapa} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{p.label}</span>
                  <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full ${p.color} rounded`}
                      style={{ width: `${Math.max(6, (p.count / kpi.maxEtapa) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-6 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
