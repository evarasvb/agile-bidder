import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export function PipelineTableView({ items, onRowClick }: PipelineTableViewProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Oportunidad</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Institución</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Cierre</TableHead>
            <TableHead className="text-right">Match</TableHead>
            <TableHead>Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No hay oportunidades en el pipeline
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const config = ETAPA_CONFIG[item.etapa];
              const deadlineDays = item.fecha_cierre
                ? differenceInDays(parseISO(item.fecha_cierre), new Date())
                : null;
              const isUrgent = deadlineDays !== null && deadlineDays < 3;

              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onRowClick(item)}
                >
                  <TableCell className="font-medium">
                    <span className="line-clamp-1">{item.titulo}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(config.badgeColor, 'text-xs whitespace-nowrap')}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[180px] truncate">
                    {item.institucion || '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.monto_estimado != null ? formatCLP(item.monto_estimado) : '—'}
                  </TableCell>
                  <TableCell>
                    {item.fecha_cierre ? (
                      <span className={cn('text-sm', isUrgent && 'text-red-600 font-semibold')}>
                        {format(parseISO(item.fecha_cierre), 'dd MMM yyyy', { locale: es })}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.match_score > 0 ? (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          item.match_score >= 80
                            ? 'text-green-600'
                            : item.match_score >= 50
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        )}
                      >
                        {item.match_score}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 capitalize">
                    {item.oportunidad_tipo === 'compra_agil'
                      ? 'Compra Ágil'
                      : item.oportunidad_tipo === 'licitacion'
                      ? 'Licitación'
                      : 'Manual'}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
