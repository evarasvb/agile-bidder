import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { ETAPA_CONFIG, type PipelineItem } from './pipelineConstants';

interface PipelineTableViewProps {
  items: PipelineItem[];
  onRowClick: (item: PipelineItem) => void;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

const TIPO_LABEL: Record<string, string> = {
  compra_agil: 'Compra Ágil',
  licitacion: 'Licitación',
};

const tipoLabel = (item: PipelineItem) => TIPO_LABEL[item.oportunidad_tipo] ?? 'Manual';

const COLUMNAS_PIPELINE: DataTableColumn<PipelineItem>[] = [
  {
    id: 'titulo',
    header: 'Oportunidad',
    headerClassName: 'w-[300px]',
    className: 'font-medium',
    sortValue: (item) => item.titulo,
    cell: (item) => <span className="line-clamp-1">{item.titulo}</span>,
  },
  {
    id: 'etapa',
    header: 'Etapa',
    sortValue: (item) => ETAPA_CONFIG[item.etapa].label,
    cell: (item) => (
      <Badge className={cn(ETAPA_CONFIG[item.etapa].badgeColor, 'text-xs whitespace-nowrap')}>
        {ETAPA_CONFIG[item.etapa].label}
      </Badge>
    ),
  },
  {
    id: 'institucion',
    header: 'Institución',
    className: 'text-sm text-gray-600 max-w-[180px] truncate',
    sortValue: (item) => item.institucion,
    exportValue: (item) => item.institucion ?? '',
    cell: (item) => item.institucion || '—',
  },
  {
    id: 'monto',
    header: 'Monto',
    align: 'right',
    className: 'text-sm',
    sortValue: (item) => item.monto_estimado,
    cell: (item) => (item.monto_estimado != null ? formatCLP(item.monto_estimado) : '—'),
  },
  {
    id: 'cierre',
    header: 'Cierre',
    sortValue: (item) => item.fecha_cierre,
    exportValue: (item) => (item.fecha_cierre ? format(parseISO(item.fecha_cierre), 'dd-MM-yyyy') : ''),
    cell: (item) => {
      if (!item.fecha_cierre) return <span className="text-sm text-gray-400">—</span>;
      const isUrgent = differenceInDays(parseISO(item.fecha_cierre), new Date()) < 3;
      return (
        <span className={cn('text-sm', isUrgent && 'text-red-600 font-semibold')}>
          {format(parseISO(item.fecha_cierre), 'dd MMM yyyy', { locale: es })}
        </span>
      );
    },
  },
  {
    id: 'match',
    header: 'Afinidad',
    align: 'right',
    sortValue: (item) => (item.match_score > 0 ? item.match_score : null),
    exportValue: (item) => (item.match_score > 0 ? `${item.match_score}%` : ''),
    cell: (item) =>
      item.match_score > 0 ? (
        <span
          className={cn(
            'text-sm font-medium',
            item.match_score >= 80 ? 'text-green-600' : item.match_score >= 50 ? 'text-amber-600' : 'text-gray-500',
          )}
        >
          {item.match_score}%
        </span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      ),
  },
  {
    id: 'tipo',
    header: 'Tipo',
    className: 'text-xs text-gray-500',
    sortValue: tipoLabel,
    cell: tipoLabel,
  },
];

export function PipelineTableView({ items, onRowClick }: PipelineTableViewProps) {
  return (
    <DataTable<PipelineItem>
      storageKey="pipeline-tabla"
      rows={items}
      rowKey={(item) => item.id}
      columns={COLUMNAS_PIPELINE}
      itemLabel="oportunidades"
      searchText={(item) => `${item.titulo} ${item.institucion ?? ''} ${ETAPA_CONFIG[item.etapa].label} ${tipoLabel(item)}`}
      searchPlaceholder="Buscar por oportunidad, institución o etapa…"
      defaultSort={{ id: 'cierre', dir: 'asc' }}
      exportFileName="pipeline-comercial"
      emptyMessage="No hay oportunidades en el pipeline"
      onRowClick={onRowClick}
    />
  );
}
