import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Send, Save, Mail, Facebook, Instagram, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { usePiezaEjecuciones, type MarketingPieza } from '@/hooks/useMarketingCampaigns';

interface PiezaDetalleDialogProps {
  pieza: MarketingPieza | null;
  onOpenChange: (open: boolean) => void;
  onGuardar: (id: string, updates: Partial<MarketingPieza>) => void;
  onEjecutar: (id: string) => void;
  guardando: boolean;
  ejecutando: boolean;
}

const ICONOS: Record<string, typeof Mail> = { email: Mail, facebook: Facebook, instagram: Instagram, whatsapp: MessageCircle };

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', enviado: 'Enviado', entregado: 'Entregado',
  click: 'Con click', fallo: 'Falló', rebote: 'Rebotó',
};

export function PiezaDetalleDialog({ pieza, onOpenChange, onGuardar, onEjecutar, guardando, ejecutando }: PiezaDetalleDialogProps) {
  const [asunto, setAsunto] = useState('');
  const [contenido, setContenido] = useState('');
  const [hashtags, setHashtags] = useState('');
  const { ejecuciones, isLoading: cargandoEjecuciones } = usePiezaEjecuciones(pieza?.id || '');

  useEffect(() => {
    if (pieza) {
      setAsunto(pieza.asunto || '');
      setContenido(pieza.contenido || '');
      setHashtags((pieza as any).hashtags || '');
    }
  }, [pieza]);

  if (!pieza) return null;
  const Icon = ICONOS[pieza.canal] || Mail;
  const esBorrador = pieza.estado === 'draft';
  const esEmail = pieza.canal === 'email';
  const esSocial = pieza.canal === 'facebook' || pieza.canal === 'instagram';
  const puedeEjecutarAutomatico = esEmail; // Facebook/Instagram/WhatsApp aún se publican/mandan a mano.

  const guardarCambios = () => {
    const updates: Partial<MarketingPieza> = { contenido };
    if (esEmail) updates.asunto = asunto;
    if (esSocial) (updates as any).hashtags = hashtags;
    onGuardar(pieza.id, updates);
    toast.success('Cambios guardados');
  };

  return (
    <Dialog open={!!pieza} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-4 h-4" />{pieza.nombre}
            <Badge variant={pieza.estado === 'ejecutado' ? 'default' : 'outline'} className="capitalize ml-1">{pieza.estado}</Badge>
          </DialogTitle>
          <DialogDescription>
            {esBorrador ? 'Todavía es borrador — puedes editar el contenido antes de mandarlo.' : 'Ya se ejecutó; el contenido queda como referencia.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {esEmail && (
            <div>
              <Label className="text-xs">Asunto</Label>
              <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} disabled={!esBorrador} />
            </div>
          )}
          <div>
            <Label className="text-xs">{esEmail ? 'Contenido (HTML)' : esSocial ? 'Texto del post' : 'Mensaje'}</Label>
            <Textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              disabled={!esBorrador}
              rows={esEmail ? 7 : 4}
              className={esEmail ? 'font-mono text-xs' : ''}
            />
          </div>
          {esSocial && (
            <div>
              <Label className="text-xs">Hashtags</Label>
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} disabled={!esBorrador} />
            </div>
          )}

          {esBorrador && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={guardarCambios} disabled={guardando} className="gap-1.5">
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar cambios
              </Button>
              {puedeEjecutarAutomatico && (
                <Button size="sm" onClick={() => onEjecutar(pieza.id)} disabled={ejecutando} className="gap-1.5">
                  {ejecutando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar a suscriptores
                </Button>
              )}
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <Label className="text-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />A quién se le envió</Label>
            {!puedeEjecutarAutomatico ? (
              <p className="text-xs text-muted-foreground">
                {pieza.canal === 'whatsapp' ? 'WhatsApp' : pieza.canal === 'facebook' ? 'Facebook' : 'Instagram'} todavía no tiene envío/publicación automática conectada, así que no hay una lista de destinatarios acá — lo mandas o publicas tú mismo con el contenido de arriba.
              </p>
            ) : cargandoEjecuciones ? (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            ) : ejecuciones.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no se ha enviado a nadie.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Abierto</TableHead>
                      <TableHead className="text-xs">Clicks</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ejecuciones.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{e.email}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={e.estado === 'fallo' || e.estado === 'rebote' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {ESTADO_LABEL[e.estado] || e.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{e.abierto ? 'Sí' : 'No'}</TableCell>
                        <TableCell className="text-xs">{e.clicks || 0}</TableCell>
                        <TableCell className="text-xs">{e.fecha_envio ? new Date(e.fecha_envio).toLocaleString('es-CL') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
