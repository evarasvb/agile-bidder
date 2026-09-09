import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface NuevaCampanaRapidaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated?: () => void;
}

export function NuevaCampanaRapida({ open, onOpenChange, onCampaignCreated }: NuevaCampanaRapidaProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    objetivo: '',
    asunto: '',
    contenido: '',
    ejecutarAhora: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear campaña
      const { data: campana, error: campanaError } = await supabase
        .from('marketing_campanas')
        .insert([
          {
            nombre: formData.nombre,
            objetivo: formData.objetivo,
            estado: 'draft',
            creado_por: 'evaras@firmavb.cl',
          },
        ])
        .select()
        .single();

      if (campanaError) throw campanaError;

      // 2. Crear pieza
      const { data: pieza, error: piezaError } = await supabase
        .from('marketing_piezas')
        .insert([
          {
            campana_id: campana.id,
            nombre: `Email: ${formData.nombre}`,
            tipo: 'email',
            canal: 'email',
            asunto: formData.asunto,
            contenido: formData.contenido,
            estado: 'draft',
          },
        ])
        .select()
        .single();

      if (piezaError) throw piezaError;

      if (formData.ejecutarAhora) {
        // 3. Ejecutar inmediatamente
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ejecutar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
            },
            body: JSON.stringify({ pieza_id: pieza.id }),
          }
        );

        if (!response.ok) throw new Error('Error al ejecutar campaña');

        const result = await response.json();
        toast.success(`Campaña enviada: ${result.total_exitosos}/${result.total_enviados} exitosos`);
      } else {
        toast.success('Campaña creada. Ejecuta desde el panel.');
      }

      setFormData({ nombre: '', objetivo: '', asunto: '', contenido: '', ejecutarAhora: true });
      onOpenChange(false);
      onCampaignCreated?.();
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva Campaña Rápida</DialogTitle>
          <DialogDescription>
            Crea y ejecuta una campaña de email inmediatamente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre de la Campaña</Label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="ej: Follow-up Webinar Convenio Marco"
              required
            />
          </div>

          <div>
            <Label>Objetivo</Label>
            <Input
              value={formData.objetivo}
              onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
              placeholder="ej: Recordatorio de webinar para asistentes"
              required
            />
          </div>

          <div>
            <Label>Asunto del Email</Label>
            <Input
              value={formData.asunto}
              onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
              placeholder="ej: ¿Te lo perdiste? Aquí está la grabación"
              required
            />
          </div>

          <div>
            <Label>Contenido (HTML)</Label>
            <Textarea
              value={formData.contenido}
              onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
              placeholder="Paste HTML content here"
              rows={6}
              required
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ejecutarAhora"
              checked={formData.ejecutarAhora}
              onChange={(e) => setFormData({ ...formData, ejecutarAhora: e.target.checked })}
            />
            <Label htmlFor="ejecutarAhora" className="cursor-pointer">
              Ejecutar inmediatamente a todos los suscriptores
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Creando...' : 'Crear y Ejecutar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
