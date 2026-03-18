import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvitarMiembro } from '@/hooks/useEquipo';

interface InvitarMiembroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvitarMiembroDialog({ open, onOpenChange }: InvitarMiembroDialogProps) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    rol: 'vendedor',
    telefono: '',
  });
  const invitarMutation = useInvitarMiembro();

  const handleSubmit = () => {
    if (!form.nombre || !form.email) return;

    invitarMutation.mutate(
      {
        nombre: form.nombre,
        email: form.email,
        rol: form.rol,
        telefono: form.telefono || undefined,
      },
      {
        onSuccess: () => {
          setForm({ nombre: '', email: '', rol: 'vendedor', telefono: '' });
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invitar Miembro al Equipo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Pérez"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@empresa.cl"
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono (opcional)</Label>
            <Input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="+56 9 1234 5678"
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin - Acceso completo</SelectItem>
                <SelectItem value="vendedor">Vendedor - Pipeline y asignaciones</SelectItem>
                <SelectItem value="viewer">Viewer - Solo lectura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.nombre || !form.email || invitarMutation.isPending}
          >
            {invitarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Invitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
