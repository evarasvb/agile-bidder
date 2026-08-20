import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Package, Sparkles, FileText, Plug, X, ArrowRight, Rocket, PartyPopper,
} from "lucide-react";
import { useInventoryStats } from "@/hooks/useInventory";
import { useClienteOfertas } from "@/hooks/useClienteOfertas";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";

const OCULTO_KEY = "fvb_primeros_pasos_oculto";
const VISTO_OPS_KEY = "fvb_paso_oportunidades_visto";

/** Panel "Empieza aquí": lleva de la mano al cliente nuevo por la rutina básica
 *  de firmavb (inventario → oportunidades → primera oferta → extensión). Cada
 *  paso se marca solo al cumplirse; se puede ocultar cuando ya no hace falta. */
export function PrimerosPasos() {
  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(OCULTO_KEY) === "1"; } catch { return false; }
  });
  const [vistoOps, setVistoOps] = useState(() => {
    try { return localStorage.getItem(VISTO_OPS_KEY) === "1"; } catch { return false; }
  });

  const { data: invStats } = useInventoryStats();
  const { data: ofertas } = useClienteOfertas();
  const { isConnected } = useExtensionStatus();

  const tieneInventario = (invStats?.total ?? 0) > 0;
  const tieneOfertas = (ofertas?.length ?? 0) > 0;
  const revisoOportunidades = vistoOps || tieneOfertas;

  const ocultar = () => {
    try { localStorage.setItem(OCULTO_KEY, "1"); } catch { /* noop */ }
    setOculto(true);
  };
  const marcarVistoOps = () => {
    try { localStorage.setItem(VISTO_OPS_KEY, "1"); } catch { /* noop */ }
    setVistoOps(true);
  };

  if (oculto) return null;

  const pasos = [
    {
      done: tieneInventario, icon: Package,
      titulo: "Carga tu inventario",
      desc: "Es lo que firmavb usa para encontrar las oportunidades que puedes ganar. Sin esto, no hay match.",
      cta: "Cargar mis productos", to: "/inventario",
    },
    {
      done: revisoOportunidades, icon: Sparkles,
      titulo: "Revisa tus oportunidades",
      desc: "Mira las licitaciones y compras ágiles que calzan con tus productos, con su % de match.",
      cta: "Ver mis oportunidades", to: "/mis-oportunidades", onClick: marcarVistoOps,
    },
    {
      done: tieneOfertas, icon: FileText,
      titulo: "Genera tu primera oferta",
      desc: "Elige una oportunidad y crea la oferta con tus precios en un par de clics.",
      cta: "Ir a Compras Ágiles", to: "/compras-agiles",
    },
    {
      done: isConnected, opcional: true, icon: Plug,
      titulo: "Conecta la extensión (opcional)",
      desc: "Para postular más rápido en Mercado Público y activar el Auto-Bid.",
      cta: "Cómo conectarla", to: "/configuracion/extension",
    },
  ];

  const obligatorios = pasos.filter((p) => !p.opcional);
  const hechos = obligatorios.filter((p) => p.done).length;
  const totalOblig = obligatorios.length;
  const pct = Math.round((hechos / totalOblig) * 100);
  const completo = hechos === totalOblig;

  // Índice del primer paso pendiente (para destacarlo como "siguiente").
  const siguienteIdx = pasos.findIndex((p) => !p.done);

  if (completo) {
    return (
      <Card className="border-firmavb-green/30 bg-firmavb-green/5">
        <CardContent className="py-4 flex items-center gap-3">
          <PartyPopper className="h-5 w-5 text-firmavb-green shrink-0" />
          <p className="text-sm flex-1">
            <span className="font-semibold">¡Ya sabes operar firmavb!</span> Completaste los primeros pasos. Revisa tus oportunidades cuando quieras.
          </p>
          <Button variant="ghost" size="sm" onClick={ocultar}>Ocultar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-firmavb-blue/20 shadow-sm">
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-firmavb-blue/10 blur-3xl" />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-firmavb-blue/10 text-firmavb-blue"><Rocket className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Empieza aquí</h2>
              <p className="text-sm text-muted-foreground">4 pasos para operar firmavb. Te tomará unos minutos.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={ocultar} aria-label="Ocultar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">{hechos} de {totalOblig}</span>
        </div>

        <div className="mt-4 space-y-2.5">
          {pasos.map((p, i) => {
            const esSiguiente = i === siguienteIdx;
            const Icon = p.icon;
            return (
              <div
                key={p.titulo}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  p.done ? "border-firmavb-green/30 bg-firmavb-green/5"
                  : esSiguiente ? "border-firmavb-blue/40 bg-firmavb-blue/[0.04]"
                  : "border-border/60"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {p.done
                    ? <CheckCircle2 className="h-5 w-5 text-firmavb-green" />
                    : <Icon className={`h-5 w-5 ${esSiguiente ? "text-firmavb-blue" : "text-muted-foreground"}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${p.done ? "text-muted-foreground line-through" : ""}`}>{p.titulo}</p>
                  {!p.done && <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>}
                </div>
                {!p.done && (
                  <Button
                    asChild
                    size="sm"
                    variant={esSiguiente ? "default" : "outline"}
                    className={`shrink-0 ${esSiguiente ? "bg-firmavb-blue hover:bg-firmavb-blue/90" : ""}`}
                  >
                    <Link to={p.to} onClick={p.onClick}>
                      {p.cta}<ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
