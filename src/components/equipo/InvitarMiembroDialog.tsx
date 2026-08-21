import { useState } from 'react';
import { Loader2, UserPlus, CheckCircle2, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvitarMiembro, type InvitacionResultado } from '@/hooks/useEquipo';
import { toast } from 'sonner';

interface InvitarMiembroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvitarMiembroDialog({ open, onOpenChange }: InvitarMiembroDialogProps) {
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'vendedor', telefono: '' });
  const [enviado, setEnviado] = useState<InvitacionResultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const invitarMutation = useInvitarMiembro();

  const cerrar = (v: boolean) => {
    if (!v) {
      setForm({ nombre: '', email: '', rol: 'vendedor', telefono: '' });
      setEnviado(null);
      setCopiado(false);
    }
    onOpenChange(v);
  };

  const handleSubmit = () => {
    if (!form.nombre || !form.email) return;
    invitarMutation.mutate(
      { nombre: form.nombre, email: form.email, rol: form.rol, telefono: form.telefono || undefined },
      { onSuccess: (res) => setEnviado(res) },
    );
  };

  const mensaje = enviado
    ? `Hola ${form.nombre || ''}, te invito a sumarte a mi equipo en FirmaVB para vender al Estado. Activa tu cuenta aquí: ${enviado.activation_url}`
    : '';
  const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  const mailUrl = `mailto:${enviado?.email || ''}?subject=${encodeURIComponent('Te invito a FirmaVB')}&body=${encodeURIComponent(mensaje)}`;

  const copiarLink = async () => {
    if (!enviado) return;
    try {
      await navigator.clipboard.writeText(enviado.activation_url);
      setCopiado(true);
      toast.success('Enlace copiado');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-[460px]">
        {!enviado ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Invitar Miembro al Equipo
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@empresa.cl" />
                <p className="text-xs text-muted-foreground">Le llegará un correo para activar su cuenta.</p>
              </div>
              <div className="space-y-2">
                <Label>Teléfono (opcional)</Label>
                <Input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+56 9 1234 5678" />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Acceso completo</SelectItem>
                    <SelectItem value="vendedor">Vendedor — Pipeline y asignaciones</SelectItem>
                    <SelectItem value="visor">Visor — Solo lectura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => cerrar(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!form.nombre || !form.email || invitarMutation.isPending}>
                {invitarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear y enviar invitación
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                Invitación creada
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {enviado.email_enviado
                  ? <>Le enviamos un correo a <strong className="text-foreground">{enviado.email}</strong> para activar su cuenta.</>
                  : <>No pudimos enviar el correo automáticamente. Comparte el enlace de activación tú mismo:</>}
              </p>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Enlace de activación</p>
                <p className="text-xs font-mono break-all text-foreground">{enviado.activation_url}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Compartir invitación</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 text-[hsl(var(--success))]" /> WhatsApp
                    </a>
                  </Button>
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={mailUrl}>
                      <Mail className="h-4 w-4 text-primary" /> Email
                    </a>
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={copiarLink}>
                    {copiado ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setEnviado(null); }}>
                Invitar a otra persona
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => cerrar(false)}>Listo</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
