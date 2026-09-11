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

type CanalTipo = 'email' | 'facebook' | 'instagram' | 'whatsapp';

export function NuevaCampanaRapida({ open, onOpenChange, onCampaignCreated }: NuevaCampanaRapidaProps) {
  const [loading, setLoading] = useState(false);
  const [canal, setCanal] = useState<CanalTipo>('email');
  const [formData, setFormData] = useState({
    nombre: '',
    objetivo: '',
    asunto: '', // para email
    contenido: '',
    caption: '', // para redes
    hashtags: '',
    imagenUrl: '',
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
            canal_primario: canal,
          },
        ])
        .select()
        .single();

      if (campanaError) throw campanaError;

      // 2. Crear pieza según canal
      const nombrePieza = canal === 'email'
        ? `Email: ${formData.nombre}`
        : `${canal.charAt(0).toUpperCase() + canal.slice(1)}: ${formData.nombre}`;

      const piezaData = {
        campana_id: campana.id,
        nombre: nombrePieza,
        tipo: canal === 'email' ? 'email' : 'social',
        canal,
        ...(canal === 'email' && {
          asunto: formData.asunto,
          contenido: formData.contenido,
        }),
        ...((canal === 'facebook' || canal === 'instagram') && {
          contenido: formData.caption,
          hashtags: formData.hashtags,
          imagen_url: formData.imagenUrl,
        }),
        estado: 'draft',
      };

      const { data: pieza, error: piezaError } = await supabase
        .from('marketing_piezas')
        .insert([piezaData])
        .select()
        .single();

      if (piezaError) throw piezaError;

      if (formData.ejecutarAhora && canal === 'email') {
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
      } else if (canal === 'facebook' || canal === 'instagram') {
        toast.success(`Campaña de ${canal} creada. Se publicará automáticamente según el calendario.`);
      } else {
        toast.success('Campaña creada. Ejecuta desde el panel.');
      }

      setFormData({ nombre: '', objetivo: '', asunto: '', contenido: '', caption: '', hashtags: '', imagenUrl: '', ejecutarAhora: true });
      setCanal('email');
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Campaña</DialogTitle>
          <DialogDescription>
            Elige canal y crea tu campaña
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CANAL SELECTOR */}
          <div>
            <Label>Canal</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {(['email', 'facebook', 'instagram', 'whatsapp'] as CanalTipo[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setCanal(ch)}
                  className={`p-2 rounded border-2 transition ${
                    canal === ch
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {ch === 'email' && '📧 Email'}
                  {ch === 'facebook' && '📘 Facebook'}
                  {ch === 'instagram' && '📷 Instagram'}
                  {ch === 'whatsapp' && '💬 WhatsApp'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Nombre de la Campaña</Label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="ej: Follow-up Webinar, Post Lanzamiento, etc."
              required
            />
          </div>

          <div>
            <Label>Objetivo</Label>
            <Input
              value={formData.objetivo}
              onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
              placeholder="¿Qué quieres lograr con esta campaña?"
              required
            />
          </div>

          {/* EMAIL FIELDS */}
          {canal === 'email' && (
            <>
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
            </>
          )}

          {/* SOCIAL MEDIA FIELDS */}
          {(canal === 'facebook' || canal === 'instagram') && (
            <>
              <div>
                <Label>Caption/Texto</Label>
                <Textarea
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  placeholder="Escribe el texto del post..."
                  rows={4}
                  required
                />
              </div>
              <div>
                <Label>URL de Imagen</Label>
                <Input
                  value={formData.imagenUrl}
                  onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  type="url"
                  required={canal === 'instagram'}
                />
              </div>
              <div>
                <Label>Hashtags</Label>
                <Input
                  value={formData.hashtags}
                  onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                  placeholder="#licitación #estado #oportunidad"
                />
              </div>
            </>
          )}

          {/* EXECUTION OPTIONS */}
          {canal === 'email' && (
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
          )}
          {(canal === 'facebook' || canal === 'instagram') && (
            <p className="text-sm text-muted-foreground">
              ℹ️ Se agregará al calendario y se publicará automáticamente a las 15:00 UTC
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
