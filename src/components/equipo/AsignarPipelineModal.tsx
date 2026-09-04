import { useState } from 'react';
import { Loader2, UserPlus, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useEquipoMembers, useAsignarPipeline } from '@/hooks/useEquipo';
import type { PipelineItem } from '@/components/pipeline/pipelineConstants';

interface AsignarPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem;
}

export function AsignarPipelineModal({ open, onOpenChange, item }: AsignarPipelineModalProps) {
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [notas, setNotas] = useState('');
  const { data: members, isLoading: loadingMembers } = useEquipoMembers();
  const asignarMutation = useAsignarPipeline();

  const activeMembers = members?.filter((m) => m.activo) || [];

  const handleAsignar = () => {
    if (!selectedVendedor) return;
    asignarMutation.mutate(
      {
        pipelineId: item.id,
        oportunidadId: item.oportunidad_id,
        vendedorId: selectedVendedor,
        montoEstimado: item.monto_estimado ?? undefined,
        fechaCierre: item.fecha_cierre ?? undefined,
        notas: notas || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedVendedor('');
          setNotas('');
        },
      }
    );
  };

  const formatCLP = (value: number | null) => {
    if (!value) return 'No especificado';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Asignar Vendedor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pipeline item info */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="font-medium text-sm line-clamp-2">{item.titulo}</h4>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {item.institucion && <span>{item.institucion}</span>}
              <span>{formatCLP(item.monto_estimado)}</span>
            </div>
          </div>

          {/* Vendor selector */}
          <div className="space-y-2">
            <Label>Seleccionar vendedor</Label>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-primary/10">
                            {member.nombre
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.nombre}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {activeMembers.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No hay vendedores activos
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones para el vendedor..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAsignar}
            disabled={!selectedVendedor || asignarMutation.isPending}
          >
            {asignarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
