import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Building2, DollarSign, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { PipelineItem } from './pipelineConstants';

interface PipelineCardProps {
  item: PipelineItem;
  onClick: (item: PipelineItem) => void;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDaysInStage(item: PipelineItem): number {
  const historial = item.etapa_historial;
  if (!historial.length) return differenceInDays(new Date(), parseISO(item.created_at));
  const lastEntry = historial[historial.length - 1];
  return differenceInDays(new Date(), parseISO(lastEntry.fecha));
}

export function PipelineCard({ item, onClick }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const daysInStage = getDaysInStage(item);
  const deadlineDays = item.fecha_cierre
    ? differenceInDays(parseISO(item.fecha_cierre), new Date())
    : null;

  const isUrgent = deadlineDays !== null && deadlineDays < 3;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-primary/30 transition-all duration-150',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20'
      )}
      onClick={() => onClick(item)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
            {item.titulo}
          </p>

          {/* Match score badge */}
          {item.match_score > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'text-xs',
                item.match_score >= 80
                  ? 'bg-green-100 text-green-700'
                  : item.match_score >= 50
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {item.match_score}% match
            </Badge>
          )}

          {/* Institution */}
          {item.institucion && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.institucion}</span>
            </div>
          )}

          {/* Amount */}
          {item.monto_estimado != null && (
            <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
              <DollarSign className="h-3 w-3 shrink-0" />
              {formatCLP(item.monto_estimado)}
            </div>
          )}

          {/* Footer: deadline + days in stage */}
          <div className="flex items-center justify-between pt-1">
            {item.fecha_cierre ? (
              <span
                className={cn(
                  'text-xs',
                  isUrgent ? 'text-red-600 font-semibold' : 'text-gray-500'
                )}
              >
                {isUrgent && '⏰ '}
                {format(parseISO(item.fecha_cierre), 'dd MMM', { locale: es })}
              </span>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {daysInStage}d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
