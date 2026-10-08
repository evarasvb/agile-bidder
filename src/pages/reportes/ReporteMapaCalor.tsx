import { useMemo, useState } from 'react';
import { Flame, MapPin, Building2, X } from 'lucide-react';
import { ReportHero } from '@/components/reportes/ReportHero';
import { ChileHeatMap, type Capa } from '@/components/reportes/ChileHeatMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMapaCalorRegiones, useMapaCalorDetalle } from '@/hooks/useMapaCalor';
import { formatCompact, formatNumber } from '@/hooks/useReportes';

const CAPAS: { value: Capa; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'lic', label: 'Licitaciones' },
  { value: 'ca', label: 'Compra Ágil' },
];

export default function ReporteMapaCalor() {
  const { data = [], isLoading } = useMapaCalorRegiones();
  const [capa, setCapa] = useState<Capa>('todas');
  const [region, setRegion] = useState<string | null>(null);
  const { data: detalle, isLoading: cargandoDetalle } = useMapaCalorDetalle(region);

  const totales = useMemo(() => {
    const countLic = data.reduce((a, r) => a + r.count_lic, 0);
    const countCa = data.reduce((a, r) => a + r.count_ca, 0);
    const montoLic = data.reduce((a, r) => a + r.monto_lic, 0);
    const montoCa = data.reduce((a, r) => a + r.monto_ca, 0);
    return { countLic, countCa, montoLic, montoCa };
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Mapa de calor"
        subtitle="Dónde se concentra el mercado público por región — licitaciones y compra ágil, con zoom a instituciones y comunas."
        icon={Flame}
        accent="red"
        kpis={[
          { label: 'Licitaciones', value: isLoading ? '…' : formatNumber(totales.countLic), icon: Building2 },
          { label: 'Monto licitado', value: isLoading ? '…' : formatCompact(totales.montoLic), icon: Flame },
          { label: 'Compras ágiles', value: isLoading ? '…' : formatNumber(totales.countCa), icon: Building2 },
          { label: 'Monto CA', value: isLoading ? '…' : formatCompact(totales.montoCa), icon: Flame },
        ]}
      />

      <div className="flex items-center gap-2">
        {CAPAS.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={capa === c.value ? 'default' : 'outline'}
            onClick={() => setCapa(c.value)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-card p-4">
          {isLoading ? (
            <Skeleton className="h-[500px] w-full" />
          ) : (
            <ChileHeatMap data={data} capa={capa} regionActiva={region} onSelectRegion={setRegion} />
          )}
          <p className="text-xs text-muted-foreground text-center mt-2">Clic en una región para ver el detalle de instituciones y comunas.</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {!region ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground py-10 gap-2">
              <MapPin className="h-6 w-6 opacity-50" />
              <p>Elige una región en el mapa para ver qué instituciones y comunas concentran el volumen.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{region}</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7 -mt-1 -mr-1" onClick={() => setRegion(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {cargandoDetalle ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Instituciones con más volumen</p>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {(detalle?.instituciones ?? []).map((i) => (
                        <div key={i.rut} className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{i.nombre || i.rut}</p>
                            <p className="text-muted-foreground">
                              {i.count_lic > 0 && `${i.count_lic} lic.`}
                              {i.count_lic > 0 && i.count_ca > 0 && ' · '}
                              {i.count_ca > 0 && `${i.count_ca} CA`}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0">{formatCompact(i.monto_total)}</Badge>
                        </div>
                      ))}
                      {(detalle?.instituciones ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">Sin datos para esta región.</p>
                      )}
                    </div>
                  </div>

                  {(detalle?.comunas ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Comunas (licitaciones)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detalle?.comunas ?? []).map((c) => (
                          <Badge key={c.comuna} variant="secondary" className="text-xs">
                            {c.comuna} · {formatNumber(c.count)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
