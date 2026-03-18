import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Building2,
  DollarSign,
  CalendarDays,
  ExternalLink,
  Trash2,
  Clock,
  FileText,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ETAPA_CONFIG,
  ETAPA_LIST,
  type PipelineItem,
  type PipelineEtapa,
} from './pipelineConstants';
import { useUpdatePipelineItem, useMovePipelineItem, useDeletePipelineItem } from '@/hooks/usePipeline';
import { toast } from 'sonner';

interface PipelineDetailModalProps {
  item: PipelineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PipelineDetailModal({
  item,
  open,
  onOpenChange,
}: PipelineDetailModalProps) {
  const [notas, setNotas] = useState('');
  const [notasEdited, setNotasEdited] = useState(false);
  const updateItem = useUpdatePipelineItem();
  const moveItem = useMovePipelineItem();
  const deleteItem = useDeletePipelineItem();

  // Sync notas when item changes
  const displayNotas = notasEdited ? notas : (item?.notas || '');

  if (!item) return null;

  const currentConfig = ETAPA_CONFIG[item.etapa];

  const handleStageChange = (newEtapa: string) => {
    moveItem.mutate(
      {
        id: item.id,
        nuevaEtapa: newEtapa as PipelineEtapa,
        currentHistorial: item.etapa_historial,
      },
      {
        onSuccess: () => toast.success(`Movido a ${ETAPA_CONFIG[newEtapa as PipelineEtapa].label}`),
        onError: () => toast.error('Error al mover'),
      }
    );
  };

  const handleSaveNotas = () => {
    updateItem.mutate(
      { id: item.id, notas },
      {
        onSuccess: () => {
          toast.success('Notas guardadas');
          setNotasEdited(false);
        },
        onError: () => toast.error('Error al guardar notas'),
      }
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        toast.success('Eliminado del pipeline');
        onOpenChange(false);
      },
      onError: () => toast.error('Error al eliminar'),
    });
  };

  const detailUrl =
    item.oportunidad_tipo === 'compra_agil'
      ? `/compras-agiles/${item.oportunidad_id}`
      : item.oportunidad_tipo === 'licitacion'
      ? `/licitaciones/${item.oportunidad_id}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg leading-tight pr-8">
            {item.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stage badge + move dropdown */}
          <div className="flex items-center gap-3">
            <Badge className={cn(currentConfig.badgeColor, 'text-xs')}>
              {currentConfig.label}
            </Badge>
            <Select value={item.etapa} onValueChange={handleStageChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Mover a..." />
              </SelectTrigger>
              <SelectContent>
                {ETAPA_LIST.map((e) => (
                  <SelectItem key={e.key} value={e.key} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', e.color)} />
                      {e.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {item.institucion && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.institucion}</span>
              </div>
            )}
            {item.monto_estimado != null && (
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="h-4 w-4 shrink-0" />
                {formatCLP(item.monto_estimado)}
              </div>
            )}
            {item.fecha_cierre && (
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {format(parseISO(item.fecha_cierre), 'dd MMM yyyy', { locale: es })}
              </div>
            )}
            {item.match_score > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-medium">{item.match_score}%</span> match
              </div>
            )}
          </div>

          {/* Link to detail page */}
          {detailUrl && (
            <a
              href={detailUrl}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver detalle de oportunidad
            </a>
          )}

          <Separator />

          {/* Stage history */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Historial de etapas
            </h4>
            {item.etapa_historial.length > 0 ? (
              <div className="space-y-1.5">
                {item.etapa_historial.map((entry, idx) => {
                  const conf = ETAPA_CONFIG[entry.etapa];
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', conf?.color || 'bg-gray-400')} />
                      <span className="font-medium">{conf?.label || entry.etapa}</span>
                      {idx < item.etapa_historial.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-gray-300" />
                      )}
                      <span className="ml-auto text-gray-400">
                        {format(parseISO(entry.fecha), 'dd/MM HH:mm', { locale: es })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin historial</p>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Notas
            </h4>
            <Textarea
              value={displayNotas}
              onChange={(e) => {
                setNotas(e.target.value);
                setNotasEdited(true);
              }}
              placeholder="Agregar notas sobre esta oportunidad..."
              className="text-sm min-h-[80px] resize-none"
            />
            {notasEdited && (
              <Button
                size="sm"
                className="mt-2"
                onClick={handleSaveNotas}
                disabled={updateItem.isPending}
              >
                Guardar notas
              </Button>
            )}
          </div>

          {/* Attachments placeholder */}
          {item.archivos && item.archivos.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Archivos</h4>
                <div className="space-y-1">
                  {item.archivos.map((archivo, idx) => (
                    <a
                      key={idx}
                      href={archivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {archivo.nombre}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Delete action */}
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar del pipeline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
