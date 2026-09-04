import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Package, Sparkles, FileText, Plug, X, ChevronRight, Rocket, PartyPopper,
} from "lucide-react";
import { useInventoryStats } from "@/hooks/useInventory";
import { useClienteOfertas } from "@/hooks/useClienteOfertas";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const OCULTO_KEY = "fvb_primeros_pasos_oculto";
const VISTO_OPS_KEY = "fvb_paso_oportunidades_visto";
const SALTADOS_KEY = "fvb_pasos_saltados";

/** Panel "Empieza aquí": lleva de la mano al cliente nuevo por la rutina básica
 *  de firmavb (inventario → oportunidades → primera oferta → extensión).
 *
 *  Reglas de UX (feedback del cliente):
 *  - TODO vinculado: la fila completa de cada paso es un enlace grande y
 *    táctil (antes el botón quedaba fuera de pantalla en el celular y "no
 *    hacía nada"). Un toque lleva directo a la pantalla del paso.
 *  - Se puede SALTAR cada paso (o la guía completa) sin quedar atascado.
 *  - Da AVISOS amables: al entrar a un paso y al completarse uno.
 *  - Se marca solo al cumplirse y celebra al terminar. */
export function PrimerosPasos() {
  const navigate = useNavigate();

  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(OCULTO_KEY) === "1"; } catch { return false; }
  });
  const [vistoOps, setVistoOps] = useState(() => {
    try { return localStorage.getItem(VISTO_OPS_KEY) === "1"; } catch { return false; }
  });
  const [saltados, setSaltados] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(SALTADOS_KEY) || "[]"); } catch { return []; }
  });

  const { data: invStats, isLoading: cargandoInv } = useInventoryStats();
  const { data: ofertas, isLoading: cargandoOf } = useClienteOfertas();
  const { isConnected } = useExtensionStatus();
  // Eventos reales: libros del Experto (licitaciones analizadas) también cuentan como avance.
  const { session } = useAuth();
  const { data: libros, isLoading: cargandoLib } = useQuery({ queryKey: ["experto_mis_libros"], enabled: !!session, queryFn: async () => ((await (supabase as any).rpc("experto_mis_libros")).data ?? []) as any[] });
  const cargando = cargandoInv || cargandoOf || cargandoLib;

  const tieneInventario = (invStats?.total ?? 0) > 0;
  const tieneOfertas = (ofertas?.length ?? 0) > 0;
  const tieneLibros = (libros?.length ?? 0) > 0;
  const revisoOportunidades = vistoOps || tieneOfertas || tieneLibros;

  const ocultar = () => {
    try { localStorage.setItem(OCULTO_KEY, "1"); } catch { /* noop */ }
    setOculto(true);
  };
  const marcarVistoOps = () => {
    try { localStorage.setItem(VISTO_OPS_KEY, "1"); } catch { /* noop */ }
    setVistoOps(true);
  };
  const saltar = (id: string, titulo: string) => {
    setSaltados((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try { localStorage.setItem(SALTADOS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    toast(`Saltaste "${titulo}"`, { description: "Puedes volver a este paso cuando quieras." });
  };

  const pasos = [
    {
      id: "inventario", done: tieneInventario, icon: Package,
      titulo: "Carga tu inventario",
      desc: "Es lo que firmavb usa para encontrar las oportunidades que puedes ganar. Sin esto, no hay match.",
      to: "/inventario",
      aviso: "Vamos a cargar tus productos 📦",
    },
    {
      id: "oportunidades", done: revisoOportunidades, icon: Sparkles,
      titulo: "Revisa tus oportunidades",
      desc: "Mira las licitaciones y compras ágiles que calzan con tus productos, con su % de match.",
      // A la BANDEJA (/oportunidades), donde están sus matches. Antes iba a
      // "Guardadas" (/mis-oportunidades), vacía para un cliente nuevo.
      to: "/oportunidades", onClick: marcarVistoOps,
      aviso: "Estas son las oportunidades que calzan contigo ✨",
    },
    {
      id: "oferta", done: tieneOfertas || tieneLibros, icon: FileText,
      titulo: "Genera tu primera oferta o analiza una licitación",
      desc: "Elige una oportunidad y crea la oferta con tus precios, o abre su libro con el Experto.",
      to: "/compras-agiles",
      aviso: "Elige una compra ágil y arma tu oferta 📝",
    },
    {
      id: "extension", done: isConnected, opcional: true, icon: Plug,
      titulo: "Conecta la extensión (opcional)",
      desc: "Para postular más rápido en Mercado Público y activar el Auto-Bid.",
      to: "/configuracion/extension",
      aviso: "Te muestro cómo conectar la extensión 🔌",
    },
  ];

  // Un paso está "resuelto" si se cumplió o si el cliente lo saltó.
  const resuelto = (p: typeof pasos[number]) => p.done || saltados.includes(p.id);

  const obligatorios = pasos.filter((p) => !p.opcional);
  const hechos = obligatorios.filter((p) => p.done).length;
  const totalOblig = obligatorios.length;
  const pct = Math.round((hechos / totalOblig) * 100);
  // La guía se considera terminada cuando ya no queda ningún paso obligatorio
  // pendiente (cumplido o saltado).
  const completo = obligatorios.every(resuelto);

  // Índice del primer paso pendiente y sin saltar (lo destacamos como "siguiente").
  const siguienteIdx = pasos.findIndex((p) => !resuelto(p));

  // AVISOS: cuando un paso pasa de pendiente a cumplido (el cliente volvió de
  // hacerlo), lo celebramos. Guardamos el estado anterior para detectar el cambio.
  const prevDone = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const celebra: Record<string, string> = {
      inventario: "¡Listo! Cargaste tu inventario ✅",
      oportunidades: "¡Ya viste tus oportunidades! 🎯",
      oferta: "¡Bien ahí! Creaste tu primera oferta 🎉",
      extension: "¡Extensión conectada! ⚡",
    };
    for (const p of pasos) {
      if (p.done && prevDone.current[p.id] === false) {
        toast.success(celebra[p.id] ?? "¡Paso completado!");
      }
      prevDone.current[p.id] = p.done;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tieneInventario, revisoOportunidades, tieneOfertas, isConnected]);

  const irAlPaso = (p: typeof pasos[number]) => {
    p.onClick?.();
    if (p.aviso) toast(p.aviso);
    navigate(p.to);
  };

  if (oculto) return null;

  if (completo) {
    if (cargando) return null; // nunca mostrar "0 de 3" antes de saber
  return (
      <Card className="border-firmavb-green/30 bg-firmavb-green/5">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <PartyPopper className="h-5 w-5 text-firmavb-green shrink-0" />
          <p className="text-sm flex-1 min-w-[200px]">
            <span className="font-semibold">¡Ya sabes operar firmavb!</span> Completaste los primeros pasos. Ahora revisa tus oportunidades cuando quieras.
          </p>
          <Button
            size="sm"
            className="bg-firmavb-blue hover:bg-firmavb-blue/90 shrink-0"
            onClick={() => navigate("/oportunidades")}
          >
            Ver mis oportunidades<ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
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
              <p className="text-sm text-muted-foreground">Toca un paso para ir directo. Te tomará unos minutos.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={ocultar} aria-label="Ocultar guía">
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
            const saltado = saltados.includes(p.id) && !p.done;
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-xl border transition-colors ${
                  p.done ? "border-firmavb-green/30 bg-firmavb-green/5"
                  : saltado ? "border-border/50 bg-muted/30 opacity-70"
                  : esSiguiente ? "border-firmavb-blue/40 bg-firmavb-blue/[0.04]"
                  : "border-border/60"
                }`}
              >
                {/* Fila completa como botón/enlace: gran objetivo táctil, funciona
                    perfecto en el celular (antes el botón chico quedaba fuera de
                    pantalla y parecía que "no hacía nada"). */}
                <button
                  type="button"
                  onClick={() => !p.done && irAlPaso(p)}
                  disabled={p.done}
                  className={`group flex flex-1 items-start gap-3 p-3 text-left min-w-0 rounded-xl ${
                    p.done ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {p.done
                      ? <CheckCircle2 className="h-5 w-5 text-firmavb-green" />
                      : <Icon className={`h-5 w-5 ${esSiguiente ? "text-firmavb-blue" : "text-muted-foreground"}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${p.done ? "text-muted-foreground line-through" : ""}`}>
                      {p.titulo}
                      {saltado && <span className="ml-2 text-xs font-normal text-muted-foreground">(saltado)</span>}
                    </p>
                    {!p.done && <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>}
                  </div>
                  {!p.done && (
                    <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>

                {/* Permitir SALTAR un paso pendiente sin quedar atascado. */}
                {!p.done && !saltado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 mr-1.5 h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => saltar(p.id, p.titulo)}
                  >
                    Saltar
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          ¿Ya sabes moverte?{" "}
          <button type="button" onClick={ocultar} className="font-medium text-firmavb-blue hover:underline">
            Omitir la guía
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
