import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Sparkles, Mail, Facebook, Instagram, MessageCircle, Check } from 'lucide-react';

interface NuevaCampanaRapidaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated?: () => void;
}

type CanalTipo = 'email' | 'facebook' | 'instagram' | 'whatsapp';

const CANALES: { id: CanalTipo; label: string; icon: typeof Mail }[] = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

interface ContenidoIA {
  nombre?: string;
  objetivo?: string;
  email?: { asunto?: string; contenido_html?: string };
  facebook?: { caption?: string; hashtags?: string };
  instagram?: { caption?: string; hashtags?: string };
  whatsapp?: { mensaje?: string };
}

const CANAL_VACIO = { asunto: '', contenido: '', caption: '', hashtags: '', imagenUrl: '', mensaje: '' };

export function NuevaCampanaRapida({ open, onOpenChange, onCampaignCreated }: NuevaCampanaRapidaProps) {
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [idea, setIdea] = useState('');
  const [canales, setCanales] = useState<CanalTipo[]>(['email']);
  const [generado, setGenerado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [porCanal, setPorCanal] = useState<Record<CanalTipo, typeof CANAL_VACIO>>({
    email: { ...CANAL_VACIO },
    facebook: { ...CANAL_VACIO },
    instagram: { ...CANAL_VACIO },
    whatsapp: { ...CANAL_VACIO },
  });
  const [ejecutarAhora, setEjecutarAhora] = useState(true);

  const toggleCanal = (c: CanalTipo) => {
    setCanales((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const actualizarCanal = (c: CanalTipo, campo: keyof typeof CANAL_VACIO, valor: string) => {
    setPorCanal((prev) => ({ ...prev, [c]: { ...prev[c], [campo]: valor } }));
  };

  const resetTodo = () => {
    setIdea('');
    setCanales(['email']);
    setGenerado(false);
    setNombre('');
    setObjetivo('');
    setPorCanal({ email: { ...CANAL_VACIO }, facebook: { ...CANAL_VACIO }, instagram: { ...CANAL_VACIO }, whatsapp: { ...CANAL_VACIO } });
    setEjecutarAhora(true);
  };

  // La IA arma nombre, objetivo y el contenido de cada canal elegido a partir
  // de la idea suelta que escribe Evaristo — todo queda editable después.
  const generarConIA = async () => {
    if (!idea.trim()) { toast.error('Cuéntame la idea de la campaña primero'); return; }
    if (canales.length === 0) { toast.error('Elige al menos un canal'); return; }
    setGenerando(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-generar-ia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ idea, canales, nombre_sugerido: nombre }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || j.error || 'No se pudo generar el contenido');
      const c: ContenidoIA = j.contenido ?? {};
      if (c.nombre) setNombre(c.nombre);
      if (c.objetivo) setObjetivo(c.objetivo);
      setPorCanal((prev) => ({
        ...prev,
        email: c.email ? { ...prev.email, asunto: c.email.asunto ?? prev.email.asunto, contenido: c.email.contenido_html ?? prev.email.contenido } : prev.email,
        facebook: c.facebook ? { ...prev.facebook, caption: c.facebook.caption ?? prev.facebook.caption, hashtags: c.facebook.hashtags ?? prev.facebook.hashtags } : prev.facebook,
        instagram: c.instagram ? { ...prev.instagram, caption: c.instagram.caption ?? prev.instagram.caption, hashtags: c.instagram.hashtags ?? prev.instagram.hashtags } : prev.instagram,
        whatsapp: c.whatsapp ? { ...prev.whatsapp, mensaje: c.whatsapp.mensaje ?? prev.whatsapp.mensaje } : prev.whatsapp,
      }));
      setGenerado(true);
      toast.success('¡Listo! Revisa el contenido y ajusta lo que quieras antes de crear la campaña.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pude generar el contenido');
    } finally {
      setGenerando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (canales.length === 0) { toast.error('Elige al menos un canal'); return; }
    setLoading(true);

    try {
      // 1. Una campaña para todos los canales elegidos.
      const { data: campana, error: campanaError } = await (supabase as any)
        .from('marketing_campanas')
        .insert([{ nombre, objetivo, estado: 'draft', creado_por: 'evaras@firmavb.cl', canal_primario: canales[0] }])
        .select()
        .single();
      if (campanaError) throw campanaError;

      // 2. Una pieza por canal.
      const avisos: string[] = [];
      for (const canal of canales) {
        const d = porCanal[canal];
        const nombrePieza = `${canal.charAt(0).toUpperCase() + canal.slice(1)}: ${nombre}`;
        const piezaData: Record<string, unknown> = {
          campana_id: campana.id,
          nombre: nombrePieza,
          tipo: canal === 'email' ? 'email' : canal === 'whatsapp' ? 'whatsapp' : 'social',
          canal,
          estado: 'draft',
          ...(canal === 'email' && { asunto: d.asunto, contenido: d.contenido }),
          ...((canal === 'facebook' || canal === 'instagram') && { contenido: d.caption, hashtags: d.hashtags, imagen_url: d.imagenUrl || null }),
          ...(canal === 'whatsapp' && { contenido: d.mensaje }),
        };

        const { data: pieza, error: piezaError } = await (supabase as any).from('marketing_piezas').insert([piezaData]).select().single();
        if (piezaError) throw piezaError;

        if (canal === 'email' && ejecutarAhora) {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ejecutar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
            },
            body: JSON.stringify({ pieza_id: pieza.id }),
          });
          if (!response.ok) throw new Error('Error al ejecutar la pieza de email');
          const result = await response.json();
          avisos.push(`Email enviado: ${result.total_exitosos}/${result.total_enviados} exitosos`);
        } else if (canal === 'email') {
          avisos.push('Email guardado como borrador (sin enviar).');
        } else if (canal === 'facebook' || canal === 'instagram') {
          avisos.push(`${canal === 'facebook' ? 'Facebook' : 'Instagram'} guardado — la publicación automática todavía no está conectada, publícalo tú por ahora.`);
        } else if (canal === 'whatsapp') {
          avisos.push('WhatsApp guardado como borrador — el envío automático todavía no está conectado, mándalo tú por ahora.');
        }
      }

      avisos.forEach((a) => toast(a));
      resetTodo();
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
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Nueva campaña</DialogTitle>
          <DialogDescription>
            Cuéntame la idea, elige por dónde sale y dejo el contenido armado. Después lo revisas y ajustas lo que quieras.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* CANALES: multi-selección */}
          <div>
            <Label>¿Por dónde sale? (puedes elegir varios)</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {CANALES.map(({ id, label, icon: Icon }) => {
                const activo = canales.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCanal(id)}
                    className={`relative flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 text-sm transition ${
                      activo ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground hover:border-muted-foreground/40'
                    }`}
                  >
                    {activo && <Check className="absolute top-1 right-1 h-3 w-3" />}
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* IDEA + IA */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <Label className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" />¿Cuál es la idea?</Label>
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="ej: convocar a proveedores del Estado a una charla para conversar sobre licitaciones y conseguir nuevos leads"
              rows={2}
              className="bg-background"
            />
            <Button type="button" size="sm" onClick={generarConIA} disabled={generando || !idea.trim() || canales.length === 0} className="gap-1.5">
              {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generando ? 'Generando…' : generado ? 'Regenerar con IA' : 'Generar con IA'}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre de la campaña</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej: Charla proveedores del Estado" required />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="¿Qué quieres lograr?" required />
            </div>
          </div>

          {/* Contenido por canal elegido */}
          {canales.map((canal) => {
            const info = CANALES.find((c) => c.id === canal)!;
            const Icon = info.icon;
            const d = porCanal[canal];
            return (
              <div key={canal} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="w-4 h-4" />{info.label}
                  {generado && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="w-2.5 h-2.5" />generado con IA</Badge>}
                </div>

                {canal === 'email' && (
                  <>
                    <div>
                      <Label className="text-xs">Asunto</Label>
                      <Input value={d.asunto} onChange={(e) => actualizarCanal('email', 'asunto', e.target.value)} placeholder="ej: ¿Te lo perdiste? Aquí está la grabación" required />
                    </div>
                    <div>
                      <Label className="text-xs">Contenido (HTML)</Label>
                      <Textarea value={d.contenido} onChange={(e) => actualizarCanal('email', 'contenido', e.target.value)} rows={6} required className="font-mono text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="ejecutarAhora" checked={ejecutarAhora} onChange={(e) => setEjecutarAhora(e.target.checked)} />
                      <Label htmlFor="ejecutarAhora" className="cursor-pointer text-xs font-normal">Enviar de inmediato a todos los suscriptores</Label>
                    </div>
                  </>
                )}

                {(canal === 'facebook' || canal === 'instagram') && (
                  <>
                    <div>
                      <Label className="text-xs">Texto del post</Label>
                      <Textarea value={d.caption} onChange={(e) => actualizarCanal(canal, 'caption', e.target.value)} rows={3} required />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Hashtags</Label>
                        <Input value={d.hashtags} onChange={(e) => actualizarCanal(canal, 'hashtags', e.target.value)} placeholder="#licitación #estado" />
                      </div>
                      <div>
                        <Label className="text-xs">URL de imagen (opcional)</Label>
                        <Input value={d.imagenUrl} onChange={(e) => actualizarCanal(canal, 'imagenUrl', e.target.value)} placeholder="https://…" type="url" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Queda guardado — la publicación automática todavía no está conectada, lo publicas tú.</p>
                  </>
                )}

                {canal === 'whatsapp' && (
                  <>
                    <div>
                      <Label className="text-xs">Mensaje</Label>
                      <Textarea value={d.mensaje} onChange={(e) => actualizarCanal('whatsapp', 'mensaje', e.target.value)} rows={3} required />
                    </div>
                    <p className="text-xs text-muted-foreground">Queda guardado — el envío automático todavía no está conectado, lo mandas tú.</p>
                  </>
                )}
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={loading || canales.length === 0}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Creando…' : 'Crear campaña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
