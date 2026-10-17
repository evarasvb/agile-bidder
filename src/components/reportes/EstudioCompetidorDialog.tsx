import { Sparkles, RefreshCw, TrendingUp, Trophy, Target, Building2, Package, Swords, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCompact, formatNumber } from '@/hooks/useReportes';
import { useProveedorZoom, useProveedorHeadToHead, useEstudioCompetidor, useGenerarEstudioCompetidor } from '@/hooks/useProveedorZoom';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

export function EstudioCompetidorDialog({ nombre, open, onOpenChange }: { nombre: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: zoom, isLoading } = useProveedorZoom(nombre, open);
  const rutNorm = zoom?.identidad?.rut_norm ?? null;
  const { data: h2h } = useProveedorHeadToHead(rutNorm);
  const { data: estudio, isLoading: cargandoEstudio } = useEstudioCompetidor(rutNorm);
  const generar = useGenerarEstudioCompetidor(nombre, rutNorm);

  const idn = zoom?.identidad;
  const lr = zoom?.licitaciones_resumen;
  const tasaExito = lr && lr.participo > 0 ? Math.round((lr.gano / lr.participo) * 100) : null;
  const td = zoom?.trato_directo;
  const pctTratoDirecto = td && td.ordenes_total > 0 ? Math.round((td.ordenes_td / td.ordenes_total) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Modo estudio: {nombre}
          </DialogTitle>
          <DialogDescription>
            {idn?.rut ? `RUT ${idn.rut} · ` : ''}Ficha profunda armada con órdenes de compra y licitaciones donde participó — no inventa nada que no esté en la base.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !idn ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No encontramos datos de este proveedor.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Kpi label="Transado" value={formatCompact(idn.monto_total)} />
              <Kpi label="Órdenes" value={formatNumber(idn.ordenes)} />
              <Kpi label="Clientes" value={formatNumber(idn.compradores)} />
              <Kpi label="Tasa de éxito en licitaciones" value={tasaExito != null ? `${tasaExito}% (${lr?.gano}/${lr?.participo})` : '—'} />
            </div>

            {pctTratoDirecto != null && pctTratoDirecto > 0 && (
              <div className="flex items-start gap-2 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p><span className="font-medium">{pctTratoDirecto}% de sus compras son trato directo</span> ({formatNumber(td!.ordenes_td)} de {formatNumber(td!.ordenes_total)} órdenes, {formatCompact(td!.monto_td)}) — compras adjudicadas sin licitación abierta.</p>
              </div>
            )}

            {zoom && zoom.tendencia_mensual.length > 1 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><TrendingUp className="h-4 w-4" /> Tendencia (últimos 12 meses)</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoom.tendencia_mensual}>
                      <XAxis dataKey="mes" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <RechartsTooltip formatter={(v: number) => formatCompact(v)} labelFormatter={(l) => l} />
                      <Bar dataKey="monto" fill="hsl(var(--firmavb-blue))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Package className="h-4 w-4" /> Productos fuertes</p>
                <div className="space-y-1.5">
                  {(zoom?.productos ?? []).slice(0, 6).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{p.producto}</span>
                      <span className="font-mono text-muted-foreground shrink-0">{formatCompact(p.monto)}</span>
                    </div>
                  ))}
                  {!zoom?.productos?.length && <p className="text-xs text-muted-foreground">Sin datos.</p>}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Building2 className="h-4 w-4" /> Clientes / instituciones</p>
                <div className="space-y-1.5">
                  {(zoom?.clientes ?? []).slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{c.comprador}</span>
                      <span className="font-mono text-muted-foreground shrink-0">{formatCompact(c.monto)}</span>
                    </div>
                  ))}
                  {!zoom?.clientes?.length && <p className="text-xs text-muted-foreground">Sin datos.</p>}
                </div>
              </div>
            </div>

            {!!zoom?.licitaciones_recientes?.length && (
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Trophy className="h-4 w-4" /> Licitaciones donde participó</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {zoom.licitaciones_recientes.map((l) => (
                    <div key={l.codigo} className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{l.titulo || l.codigo}</p>
                        <p className="text-muted-foreground truncate">{l.comprador_nombre} · {l.num_oferentes ?? '—'} oferentes</p>
                      </div>
                      <Badge variant={l.monto_ganado != null ? 'default' : 'outline'} className="shrink-0">
                        {l.monto_ganado != null ? 'Ganó' : 'Participó'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {h2h && h2h.resumen.total > 0 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Swords className="h-4 w-4" /> Cara a cara contra nosotros</p>
                <div className="flex items-center gap-2 text-xs mb-2">
                  <Badge variant="outline">Competimos en {h2h.resumen.total}</Badge>
                  <Badge variant="default">Ganamos {h2h.resumen.gano_cliente}</Badge>
                  <Badge variant="destructive">Ganó él {h2h.resumen.gano_competidor}</Badge>
                  {h2h.resumen.nadie > 0 && <Badge variant="secondary">Otro/desierta {h2h.resumen.nadie}</Badge>}
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {h2h.casos.map((c) => (
                    <div key={c.codigo} className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.titulo || c.codigo}</p>
                        <p className="text-muted-foreground truncate">{c.comprador_nombre}</p>
                      </div>
                      <Badge variant={c.gano_cliente ? 'default' : c.gano_competidor ? 'destructive' : 'secondary'} className="shrink-0">
                        {c.gano_cliente ? 'Ganamos' : c.gano_competidor ? 'Ganó él' : 'Otro'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-950/20 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-600" /> Estudio de IA</p>
                {estudio && (
                  <Button size="sm" variant="ghost" onClick={() => generar.mutate()} disabled={generar.isPending}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generar.isPending ? 'animate-spin' : ''}`} /> Regenerar
                  </Button>
                )}
              </div>
              {cargandoEstudio ? (
                <Skeleton className="h-20 w-full" />
              ) : estudio ? (
                <div className="space-y-2 text-sm">
                  <p>{estudio.resumen}</p>
                  {!!estudio.fortalezas.length && (
                    <div><p className="font-medium text-xs text-muted-foreground mb-1">Fortalezas</p>
                      <ul className="list-disc list-inside space-y-0.5">{estudio.fortalezas.map((f, i) => <li key={i}>{f}</li>)}</ul>
                    </div>
                  )}
                  {!!estudio.debilidades.length && (
                    <div><p className="font-medium text-xs text-muted-foreground mb-1">Debilidades</p>
                      <ul className="list-disc list-inside space-y-0.5">{estudio.debilidades.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </div>
                  )}
                  {estudio.recomendacion && (
                    <p className="pt-1 border-t mt-2"><span className="font-medium">Cómo competirle: </span>{estudio.recomendacion}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70">Generado {new Date(estudio.generado_en).toLocaleDateString('es-CL')}</p>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground mb-3">Pide un análisis de IA sobre sus fortalezas, debilidades y cómo competirle.</p>
                  <Button size="sm" onClick={() => generar.mutate()} disabled={generar.isPending || !rutNorm}>
                    <Sparkles className={`h-4 w-4 mr-2 ${generar.isPending ? 'animate-pulse' : ''}`} />
                    {generar.isPending ? 'Generando…' : 'Generar estudio'}
                  </Button>
                  {!rutNorm && <p className="text-[11px] text-muted-foreground/70 mt-2">No encontramos RUT para este proveedor, así que no se puede generar el estudio.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
