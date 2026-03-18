import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ETAPA_LIST, type PipelineEtapa } from './pipelineConstants';
import { useCreatePipelineItem } from '@/hooks/usePipeline';
import { toast } from 'sonner';

interface AddPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPipelineModal({ open, onOpenChange }: AddPipelineModalProps) {
  const [titulo, setTitulo] = useState('');
  const [institucion, setInstitucion] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [etapa, setEtapa] = useState<PipelineEtapa>('descubierta');
  const [notas, setNotas] = useState('');
  const createItem = useCreatePipelineItem();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('El título es requerido');
      return;
    }

    createItem.mutate(
      {
        oportunidad_id: `manual-${Date.now()}`,
        oportunidad_tipo: 'manual',
        titulo: titulo.trim(),
        institucion: institucion.trim() || undefined,
        monto_estimado: monto ? Number(monto) : undefined,
        fecha_cierre: fechaCierre || undefined,
        etapa,
        notas: notas.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Oportunidad agregada al pipeline');
          setTitulo('');
          setInstitucion('');
          setMonto('');
          setFechaCierre('');
          setEtapa('descubierta');
          setNotas('');
          onOpenChange(false);
        },
        onError: () => toast.error('Error al agregar oportunidad'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Oportunidad al Pipeline</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nombre de la oportunidad"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Institución</Label>
            <Input
              value={institucion}
              onChange={(e) => setInstitucion(e.target.value)}
              placeholder="Organismo o empresa"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Monto estimado (CLP)</Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Fecha cierre</Label>
              <Input
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Etapa inicial</Label>
            <Select value={etapa} onValueChange={(v) => setEtapa(v as PipelineEtapa)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPA_LIST.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Notas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales..."
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
