import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MoreHorizontal, Eye, Pencil, UserX, UserCheck, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEquipoMembers, useUpdateVendedor, useToggleVendedorActivo, type Vendedor } from '@/hooks/useEquipo';

const rolColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  vendedor: 'bg-blue-100 text-blue-700 border-blue-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

const rolLabels: Record<string, string> = {
  admin: 'Admin',
  vendedor: 'Vendedor',
  viewer: 'Viewer',
};

export function EquipoMemberList() {
  const navigate = useNavigate();
  const { data: members, isLoading } = useEquipoMembers();
  const updateMutation = useUpdateVendedor();
  const toggleActivoMutation = useToggleVendedorActivo();
  const [editingMember, setEditingMember] = useState<Vendedor | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', email: '', rol: '', telefono: '' });

  const handleEdit = (member: Vendedor) => {
    setEditingMember(member);
    setEditForm({
      nombre: member.nombre,
      email: member.email,
      rol: member.rol || 'vendedor',
      telefono: member.telefono || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;
    updateMutation.mutate(
      {
        id: editingMember.id,
        nombre: editForm.nombre,
        email: editForm.email,
        rol: editForm.rol,
        telefono: editForm.telefono || null,
      },
      { onSuccess: () => setEditingMember(null) }
    );
  };

  const handleToggleActivo = (member: Vendedor) => {
    toggleActivoMutation.mutate({ id: member.id, activo: !member.activo });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeMembers = members?.filter((m) => m.activo) || [];
  const inactiveMembers = members?.filter((m) => !m.activo) || [];

  return (
    <div className="space-y-6">
      {/* Active members */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeMembers.map((member) => (
          <Card key={member.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                      {member.nombre
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{member.nombre}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </div>
                    {member.telefono && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {member.telefono}
                      </div>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/equipo/${member.id}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(member)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleToggleActivo(member)}
                      className="text-destructive"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Desactivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className={rolColors[member.rol || 'vendedor']}>
                  {rolLabels[member.rol || 'vendedor']}
                </Badge>
                <Badge variant="secondary" className="bg-green-50 text-green-700">
                  Activo
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeMembers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay miembros activos en el equipo. Invita a tu primer miembro.
        </div>
      )}

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Miembros inactivos</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {inactiveMembers.map((member) => (
              <Card key={member.id} className="opacity-60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {member.nombre
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.nombre}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActivo(member)}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Reactivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Miembro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                type="tel"
                value={editForm.telefono}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editForm.rol} onValueChange={(v) => setEditForm({ ...editForm, rol: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (acceso completo)</SelectItem>
                  <SelectItem value="vendedor">Vendedor (pipeline + asignaciones)</SelectItem>
                  <SelectItem value="viewer">Viewer (solo lectura)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
