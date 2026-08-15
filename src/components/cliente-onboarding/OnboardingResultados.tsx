import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, MapPin, CalendarClock, Sparkles, PartyPopper, SearchX, Package } from 'lucide-react';
import { Cliente } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';
import { keywordsEfectivas } from './industrias';

interface Item {
  codigo: string;
  nombre: string;
  institucion_nombre: string | null;
  unidad_compra_region: string | null;
  presupuesto_estimado: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
}

function formatCLP(v: number | null): string | null {
  if (v == null || v <= 1) return null;
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
}
function formatCierre(f: string | null): string | null {
  if (!f) return null;
  try { return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return null; }
}

/**
 * Paso final del onboarding: le mostramos al cliente sus PRIMERAS oportunidades
 * reales (licitaciones abiertas que matchean sus industrias + palabras clave),
 * para que termine el onboarding viendo valor de inmediato.
 */
export default function OnboardingResultados({ cliente }: { cliente: Cliente }) {
  const keywords = keywordsEfectivas(cliente.industrias, cliente.palabras_clave_busqueda);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (keywords.length === 0) { setLoading(false); return; }
    let cancelado = false;
    setLoading(true);
    setError(false);
    (async () => {
      const { data, error: err } = await (supabase.rpc as any)('buscar_licitaciones_keywords', {
        terminos: keywords,
        limite: 8,
      });
      if (cancelado) return;
      if (err) {
        setError(true);
      } else {
        setTotal((data?.total as number) ?? 0);
        setItems((data?.items as Item[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(keywords)]);

  if (keywords.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Package className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Cuéntanos qué vendes</p>
          <p className="text-sm text-muted-foreground">
            Vuelve al paso 1, elige tu industria y agrega palabras clave para ver tus primeras oportunidades.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-primary" />
          Tus primeras oportunidades
        </CardTitle>
        <CardDescription>
          {loading
            ? 'Buscando licitaciones abiertas que calzan con lo que vendes…'
            : total > 0
              ? <>Encontramos <strong className="text-foreground">{total}</strong> licitaciones abiertas para ti. Estas son algunas:</>
              : 'Aún no hay licitaciones abiertas para estas palabras, pero te avisaremos apenas aparezcan.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analizando con IA…
          </div>
        ) : error ? (
          <div className="text-center text-muted-foreground py-8">
            No pudimos cargar las oportunidades ahora. Igual entrarás a tu panel y aparecerán ahí.
          </div>
        ) : total === 0 ? (
          <div className="text-center py-8 space-y-2">
            <SearchX className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Prueba agregar otras palabras clave en el paso 1 (ej. sinónimos de tus productos).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const monto = formatCLP(it.presupuesto_estimado);
              const cierre = formatCierre(it.fecha_cierre);
              return (
                <div key={it.codigo} className="p-4 rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium line-clamp-2">{it.nombre}</p>
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
                        <p className="font-semibold">{monto}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-2 justify-center pt-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Al finalizar entras a tu panel con todas. Con el plan gratis las <strong>miras</strong>; para postularlas y gestionarlas, Pro.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
