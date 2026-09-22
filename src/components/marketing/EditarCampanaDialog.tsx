import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketingCampaign } from '@/hooks/useMarketingCampaigns';

const ESTADOS: MarketingCampaign['estado'][] = ['draft', 'scheduled', 'ejecutando', 'completada', 'cancelada'];
const ESTADO_LABEL: Record<MarketingCampaign['estado'], string> = {
  draft: 'Borrador', scheduled: 'Programada', ejecutando: 'Ejecutando',
  completada: 'Completada', cancelada: 'Cancelada',
};

interface EditarCampanaDialogProps {
  campana: MarketingCampaign | null;
  onOpenChange: (open: boolean) => void;
  onGuardar: (id: string, updates: Partial<MarketingCampaign>) => Promise<unknown>;
  guardando: boolean;
}

export function EditarCampanaDialog({ campana, onOpenChange, onGuardar, guardando }: EditarCampanaDialogProps) {
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [estado, setEstado] = useState<MarketingCampaign['estado']>('draft');

  useEffect(() => {
    if (campana) {
      setNombre(campana.nombre);
      setObjetivo(campana.objetivo);
      setEstado(campana.estado);
    }
  }, [campana]);

  const guardar = async () => {
    if (!campana || !nombre.trim() || !objetivo.trim()) { toast.error('Nombre y objetivo son obligatorios'); return; }
    try {
      await onGuardar(campana.id, { nombre: nombre.trim(), objetivo: objetivo.trim(), estado });
      toast.success('Campaña actualizada');
      onOpenChange(false);
    } catch (error) {
      toast.error(`No se pudo guardar: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }
  };

  return (
    <Dialog open={!!campana} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Editar campaña</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editar-campana-nombre">Nombre</Label>
            <Input id="editar-campana-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-campana-objetivo">Objetivo</Label>
            <Textarea id="editar-campana-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-campana-estado">Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as MarketingCampaign['estado'])}>
              <SelectTrigger id="editar-campana-estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
