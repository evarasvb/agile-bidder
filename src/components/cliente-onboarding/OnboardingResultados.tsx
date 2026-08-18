import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, Building2, MapPin, CalendarClock, Sparkles, PartyPopper, SearchX, Package,
  FileSearch, Zap, Bell, TrendingUp, Plus, Check, Lightbulb,
} from 'lucide-react';
import { Cliente, useActualizarCliente, useClienteExclusiones } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';
import { InfoHint } from '@/components/ui/info-hint';
import { INDUSTRIAS, keywordsEfectivas } from './industrias';

interface Item {
  codigo: string;
  nombre: string;
  institucion_nombre: string | null;
  unidad_compra_region: string | null;
  presupuesto_estimado: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
}
interface Mejora { keyword: string; oportunidades: number; }
interface Resumen { lic_total: number; ca_total: number; mejoras: Mejora[]; }

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
 * Paso final del onboarding: le mostramos al cliente SU PERFIL, LO QUE VA A
 * RECIBIR (oportunidades abiertas reales que calzan) y las ÁREAS DE MEJORA que
 * detecta la IA (palabras de su rubro con más demanda que aún no tiene). Con eso
 * termina el onboarding viendo valor y afinando su perfil.
 */
export default function OnboardingResultados({ cliente }: { cliente: Cliente }) {
  const actualizar = useActualizarCliente();
  const { data: exclusiones = [] } = useClienteExclusiones();

  const industriasLabels = (cliente.industrias || [])
    .map((id) => INDUSTRIAS.find((i) => i.id === id)?.label)
    .filter(Boolean) as string[];
  const palabras = cliente.palabras_clave_busqueda ?? [];
  const keywords = useMemo(
    () => keywordsEfectivas(cliente.industrias, cliente.palabras_clave_busqueda),
    [cliente.industrias, cliente.palabras_clave_busqueda],
  );
  // Candidatas de "áreas de mejora": semillas del rubro elegido (la RPC descarta
  // las que ya tiene).
  const candidatas = useMemo(() => {
    const set = new Set<string>();
    for (const id of cliente.industrias || []) {
      INDUSTRIAS.find((i) => i.id === id)?.keywords.forEach((k) => set.add(k.toLowerCase()));
    }
    return [...set];
  }, [cliente.industrias]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState(false);
  const [agregando, setAgregando] = useState<string | null>(null);

  useEffect(() => {
    if (keywords.length === 0) { setLoading(false); return; }
    let cancelado = false;
    setLoading(true); setError(false);
    (async () => {
      try {
        const [lic, res] = await Promise.all([
          (supabase.rpc as any)('buscar_licitaciones_keywords', { terminos: keywords, limite: 6 }),
          (supabase.rpc as any)('onboarding_resumen', { p_incluidas: keywords, p_candidatas: candidatas }),
        ]);
        if (cancelado) return;
        if (lic.error) setError(true);
        else { setTotal((lic.data?.total as number) ?? 0); setItems((lic.data?.items as Item[]) ?? []); }
        if (!res.error) setResumen(res.data as Resumen);
      } catch {
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(keywords), JSON.stringify(candidatas)]);

  const agregarPalabra = async (kw: string) => {
    const t = kw.trim().toLowerCase();
    if (!t || palabras.includes(t)) return;
    setAgregando(t);
    // Optimista: sacar de las mejoras al instante.
    setResumen((r) => (r ? { ...r, mejoras: r.mejoras.filter((m) => m.keyword !== t) } : r));
    try {
      await actualizar.mutateAsync({ id: cliente.id, palabras_clave_busqueda: [...palabras, t] } as any);
    } finally {
      setAgregando(null);
    }
  };

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
    <div className="space-y-5">
      {/* Tu perfil */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Check className="h-4 w-4 text-[hsl(var(--success))]" />
            Tu perfil quedó configurado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {industriasLabels.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-muted-foreground">Rubros:</span>
              {industriasLabels.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">Palabras clave:</span>
            {palabras.length ? palabras.slice(0, 12).map((p) => <Badge key={p} variant="outline">{p}</Badge>)
              : <span className="text-muted-foreground">—</span>}
          </div>
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            {cliente.region && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{cliente.region}</span>}
            <span>{exclusiones.length} exclusión{exclusiones.length === 1 ? '' : 'es'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Lo que vas a recibir */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Lo que vas a recibir
            <InfoHint text="Contamos las oportunidades ABIERTAS del Estado que hoy calzan con tus palabras. Te avisaremos por email cuando aparezcan nuevas que te sirvan." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" /> Analizando…</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <FileSearch className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{resumen?.lic_total ?? total}</p>
                <p className="text-xs text-muted-foreground">Licitaciones</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <Zap className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{resumen?.ca_total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Compras ágiles</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <Bell className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">Email</p>
                <p className="text-xs text-muted-foreground">Alertas</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Áreas de mejora (IA) */}
      {resumen && resumen.mejoras.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              La IA detectó áreas de mejora
              <InfoHint text="Analizamos la demanda abierta del Estado y encontramos palabras de tu rubro que aún no tienes. La IA sigue aprendiendo de lo que trabajas para afinar tus matches con el tiempo." />
            </CardTitle>
            <CardDescription>
              Agrega estas palabras de tu rubro para no perderte más oportunidades:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resumen.mejoras.map((m) => (
                <button
                  type="button"
                  key={m.keyword}
                  onClick={() => agregarPalabra(m.keyword)}
                  disabled={agregando === m.keyword}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {agregando === m.keyword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span className="font-medium">{m.keyword}</span>
                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />+{m.oportunidades}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tus primeras oportunidades */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PartyPopper className="h-5 w-5 text-primary" />
            Tus primeras oportunidades
          </CardTitle>
          <CardDescription>
            {loading ? 'Buscando licitaciones abiertas que calzan con lo que vendes…'
              : total > 0 ? <>Estas son algunas de las <strong className="text-foreground">{total}</strong> que encontramos:</>
              : 'Aún no hay licitaciones abiertas para estas palabras, pero te avisaremos apenas aparezcan.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-8"><Loader2 className="h-5 w-5 animate-spin" /> Analizando con IA…</div>
          ) : error ? (
            <div className="text-center text-muted-foreground py-6">No pudimos cargar las oportunidades ahora. Igual entrarás a tu panel y aparecerán ahí.</div>
          ) : total === 0 ? (
            <div className="text-center py-6 space-y-2">
              <SearchX className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Prueba agregar otras palabras (arriba te sugerimos algunas de tu rubro).</p>
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
                            <span className="flex items-center gap-1 min-w-0"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate max-w-[220px]">{it.institucion_nombre}</span></span>
                          )}
                          {it.unidad_compra_region && (
                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{it.unidad_compra_region.trim()}</span>
                          )}
                          {cierre && (
                            <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 shrink-0" />Cierra {cierre}</span>
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
                Al finalizar entras a tu panel con todas. Con el plan gratis las <strong>miras</strong>; para postularlas, Pro.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
