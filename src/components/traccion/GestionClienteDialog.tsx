import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGuardarClienteGestion, type ClienteActividad } from '@/hooks/useAdminTraccion';

const ESTADOS = ['nuevo', 'contactado', 'en_seguimiento', 'activo', 'en_riesgo', 'perdido'] as const;
const ESTADO_LABEL: Record<(typeof ESTADOS)[number], string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', en_seguimiento: 'En seguimiento',
  activo: 'Activo', en_riesgo: 'En riesgo', perdido: 'Perdido',
};
const PRIORIDADES = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Baja' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Alta' },
];

interface GestionClienteDialogProps {
  cliente: ClienteActividad | null;
  onOpenChange: (open: boolean) => void;
}

export function GestionClienteDialog({ cliente, onOpenChange }: GestionClienteDialogProps) {
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('nuevo');
  const [prioridad, setPrioridad] = useState(0);
  const [notas, setNotas] = useState('');
  const [proximaAccion, setProximaAccion] = useState('');
  const [proximaFecha, setProximaFecha] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const guardar = useGuardarClienteGestion();

  useEffect(() => {
    if (cliente) {
      setEstado((cliente.estado_gestion as (typeof ESTADOS)[number]) || 'nuevo');
      setPrioridad(cliente.prioridad ?? 0);
      setNotas(cliente.notas ?? '');
      setProximaAccion(cliente.proxima_accion ?? '');
      setProximaFecha(cliente.proxima_fecha ? cliente.proxima_fecha.slice(0, 10) : '');
      setEtiquetas((cliente.etiquetas ?? []).join(', '));
    }
  }, [cliente]);

  const handleGuardar = async () => {
    if (!cliente) return;
    try {
      await guardar.mutateAsync({
        cliente_id: cliente.id,
        estado,
        prioridad,
        notas: notas.trim() || null,
        proxima_accion: proximaAccion.trim() || null,
        proxima_fecha: proximaFecha ? new Date(proximaFecha).toISOString() : null,
        etiquetas: etiquetas.trim() ? etiquetas.split(',').map((e) => e.trim()).filter(Boolean) : null,
      });
      toast.success('Gestión guardada');
      onOpenChange(false);
    } catch (error) {
      toast.error(`No se pudo guardar: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }
  };

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Gestionar {cliente?.empresa_nombre || cliente?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gestion-estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as (typeof ESTADOS)[number])}>
                <SelectTrigger id="gestion-estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gestion-prioridad">Prioridad</Label>
              <Select value={String(prioridad)} onValueChange={(v) => setPrioridad(Number(v))}>
                <SelectTrigger id="gestion-prioridad"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gestion-proxima-accion">Próxima acción</Label>
              <Input id="gestion-proxima-accion" value={proximaAccion} onChange={(e) => setProximaAccion(e.target.value)} placeholder="Ej: llamar, enviar cotización" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gestion-proxima-fecha">Fecha</Label>
              <Input id="gestion-proxima-fecha" type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gestion-etiquetas">Etiquetas (separadas por coma)</Label>
            <Input id="gestion-etiquetas" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Ej: reventa, oficina, urgente" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gestion-notas">Notas</Label>
            <Textarea id="gestion-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} placeholder="Historial de conversación, contexto, acuerdos…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={guardar.isPending}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
