import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, Building2, MapPin, CalendarClock, ArrowRight, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface TeaserItem {
  codigo: string;
  nombre: string;
  institucion_nombre: string | null;
  unidad_compra_region: string | null;
  presupuesto_estimado: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
}

interface TeaserResp {
  total: number;
  items: TeaserItem[];
}

function formatCLP(value: number | null): string | null {
  if (value == null || value <= 1) return null; // presupuestos "1" son placeholders sin monto real
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCierre(fecha: string | null): string | null {
  if (!fecha) return null;
  try {
    return new Date(fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

/**
 * Teaser público del buscador del landing. Un visitante anónimo escribe un
 * producto y ve unas pocas oportunidades REALES y abiertas (para engancharlo),
 * pero para ver el detalle / postular tiene que registrarse. Los datos salen de
 * un RPC acotado (buscar_teaser_licitaciones) que NO expone toda la tabla.
 */
export function TeaserResultados({ termino }: { termino: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TeaserResp | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = termino.trim();
    if (!q) {
      setData(null);
      setError(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError(false);
    (async () => {
      // El RPC es nuevo y aún no está en los tipos generados de Supabase -> cast.
      const { data: resp, error: err } = await (supabase.rpc as any)(
        "buscar_teaser_licitaciones",
        { termino: q, limite: 6 }
      );
      if (cancelado) return;
      if (err) {
        setError(true);
        setData(null);
      } else {
        setData((resp as unknown as TeaserResp) ?? { total: 0, items: [] });
      }
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [termino]);

  if (!termino.trim()) return null;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-6 flex items-center justify-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        Buscando oportunidades abiertas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-6 text-center text-muted-foreground py-6">
        No pudimos buscar en este momento. Intenta nuevamente en unos segundos.
      </div>
    );
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-6">
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-2">
            <SearchX className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Sin licitaciones abiertas para "{termino.trim()}"</p>
            <p className="text-sm text-muted-foreground">
              Prueba con otra palabra (ej: "computadores", "aseo", "papelería") o regístrate para
              recibir alertas cuando aparezca una que te sirva.
            </p>
            <Button asChild className="mt-2 bg-firmavb-blue hover:bg-firmavb-blue/90">
              <Link to="/auth">Crear cuenta gratis</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const restantes = Math.max(0, total - items.length);

  return (
    <div className="max-w-3xl mx-auto mt-6 text-left">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> oportunidad{total === 1 ? "" : "es"} abierta{total === 1 ? "" : "s"} para
          <span className="font-medium text-foreground"> "{termino.trim()}"</span>
        </p>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">En vivo</Badge>
      </div>

      <div className="space-y-3">
        {items.map((it) => {
          const monto = formatCLP(it.presupuesto_estimado);
          const cierre = formatCierre(it.fecha_cierre);
          return (
            <Card key={it.codigo} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground line-clamp-2">{it.nombre}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {it.institucion_nombre && (
                        <span className="flex items-center gap-1 min-w-0">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">{it.institucion_nombre}</span>
                        </span>
                      )}
                      {it.unidad_compra_region && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {it.unidad_compra_region.trim()}
                        </span>
                      )}
                      {cierre && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                          Cierra {cierre}
                        </span>
                      )}
                    </div>
                  </div>
                  {monto && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Presupuesto</p>
                      <p className="font-semibold text-foreground">{monto}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Candado / upsell: para ver el detalle y postular hay que registrarse */}
      <Card className="mt-4 border-firmavb-blue/30 bg-firmavb-blue/5">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 rounded-full bg-firmavb-blue/10">
              <Lock className="h-5 w-5 text-firmavb-blue" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {restantes > 0
                  ? `Regístrate gratis para ver estas y ${restantes} más`
                  : "Regístrate gratis para ver el detalle y postular"}
              </p>
              <p className="text-sm text-muted-foreground">
                Con tu cuenta miras todas las oportunidades. Para gestionarlas y postular, el plan Pro.
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="bg-firmavb-blue hover:bg-firmavb-blue/90 shrink-0">
            <Link to="/auth">
              Crear cuenta gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
