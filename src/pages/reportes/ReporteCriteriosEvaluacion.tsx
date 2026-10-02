import { ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { ReportHero } from '@/components/reportes/ReportHero';
import { useCriteriosMasFrecuentes, type CriterioFrecuente } from '@/hooks/useCriteriosEvaluacion';

// Si la ponderación quedó guardada como fracción (0-1, como la devuelve la IA
// en la mayoría de los casos reales) se muestra como %; si ya viene en
// escala 0-100 se deja tal cual.
function formatPonderacion(v: number | null): string {
  if (v == null) return '—';
  const pct = v <= 1 ? v * 100 : v;
  return `${Math.round(pct)}%`;
}

const COLUMNAS: DataTableColumn<CriterioFrecuente>[] = [
  {
    id: 'criterio',
    header: 'Criterio',
    headerClassName: 'w-[380px]',
    sortValue: (item) => item.criterio_ejemplo,
    exportValue: (item) => item.criterio_ejemplo,
    cell: (item) => <span className="font-medium whitespace-nowrap">{item.criterio_ejemplo}</span>,
  },
  {
    id: 'n_procesos',
    header: 'En cuántas licitaciones',
    align: 'right',
    sortValue: (item) => item.n_procesos,
    exportValue: (item) => item.n_procesos,
    cell: (item) => <Badge variant="outline">{item.n_procesos}</Badge>,
  },
  {
    id: 'ponderacion',
    header: 'Ponderación promedio',
    align: 'right',
    className: 'text-sm text-muted-foreground',
    sortValue: (item) => item.ponderacion_prom ?? -1,
    exportValue: (item) => formatPonderacion(item.ponderacion_prom),
    cell: (item) => formatPonderacion(item.ponderacion_prom),
  },
];

export default function ReporteCriteriosEvaluacion() {
  const { data: criterios = [], isLoading } = useCriteriosMasFrecuentes(50);

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Criterios de evaluación"
        subtitle="Qué factores se repiten más entre las licitaciones donde ya generaste el Libro de licitación — para saber en qué enfocarte al postular."
        icon={ListChecks}
        accent="violet"
        kpis={[
          { label: 'Criterios distintos', value: isLoading ? '…' : String(criterios.length), icon: ListChecks },
        ]}
      />

      {!isLoading && criterios.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay criterios extraídos. Se completan solos cada vez que alguien genera el "Libro de licitación" (Experto, plan Pro) de una licitación — cuantas más se generen, más confiable queda este reporte.
        </p>
      ) : (
        <DataTable<CriterioFrecuente>
          storageKey="reporte-criterios-evaluacion"
          rows={criterios}
          rowKey={(item) => item.criterio_ejemplo}
          columns={COLUMNAS}
          itemLabel="criterios"
          searchText={(item) => item.criterio_ejemplo}
          searchPlaceholder="Buscar criterio…"
          defaultSort={{ id: 'n_procesos', dir: 'desc' }}
          exportFileName="criterios-evaluacion"
          emptyMessage={isLoading ? 'Cargando…' : 'Sin resultados.'}
        />
      )}
    </div>
  );
}
