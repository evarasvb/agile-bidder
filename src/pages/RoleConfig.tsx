import { useState, useEffect } from 'react';
import { useRolePermissions, type RolePermission, type AppRole } from '@/hooks/useRolePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  user: 'Usuario',
  vendedor: 'Vendedor',
  visor: 'Visor',
};

const roleDescriptions: Record<AppRole, string> = {
  super_admin: 'Acceso total al sistema. Puede configurar permisos de otros roles.',
  admin: 'Gestión completa de licitaciones, inventario y vendedores.',
  user: 'Usuario estándar con acceso a licitaciones y calendario.',
  vendedor: 'Enfocado en gestión de oportunidades y postulaciones.',
  visor: 'Solo lectura de reportes e historial.',
};

export default function RoleConfigPage() {
  const { isSuperAdmin, loading: roleLoading } = useRolePermissions();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');

  useEffect(() => {
    fetchAllPermissions();
  }, []);

  const fetchAllPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('section_key', { ascending: true });

      if (error) throw error;
      setPermissions(data as RolePermission[]);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = async (permissionId: string, field: 'can_view' | 'can_edit', value: boolean) => {
    // No permitir editar permisos de super_admin
    const permission = permissions.find(p => p.id === permissionId);
    if (permission?.role === 'super_admin') {
      toast.error('No se pueden modificar los permisos de Super Admin');
      return;
    }

    // Optimistic update
    setPermissions(prev => 
      prev.map(p => p.id === permissionId ? { ...p, [field]: value } : p)
    );

    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', permissionId);

      if (error) throw error;
      toast.success('Permiso actualizado');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Error al actualizar permiso');
      // Revert optimistic update
      fetchAllPermissions();
    }
  };

  const rolePermissions = permissions.filter(p => p.role === selectedRole);

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder a esta sección. Solo los Super Admins pueden configurar roles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configuración de Roles</h1>
          <p className="text-muted-foreground">
            Define qué puede ver y editar cada tipo de usuario
          </p>
        </div>
      </div>

      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          {(Object.keys(roleLabels) as AppRole[]).map(role => (
            <TabsTrigger 
              key={role} 
              value={role}
              disabled={role === 'super_admin'}
              className="text-xs sm:text-sm"
            >
              {roleLabels[role]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(roleLabels) as AppRole[]).map(role => (
          <TabsContent key={role} value={role} className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {roleLabels[role]}
                      {role === 'super_admin' && (
                        <Badge variant="destructive">No editable</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{roleDescriptions[role]}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {permissions
                    .filter(p => p.role === role)
                    .map(permission => (
                      <div 
                        key={permission.id} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div>
                          <p className="font-medium">{permission.section_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Sección: {permission.section_key}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`view-${permission.id}`}
                              checked={permission.can_view}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(permission.id, 'can_view', checked)
                              }
                              disabled={role === 'super_admin'}
                            />
                            <Label htmlFor={`view-${permission.id}`} className="text-sm">
                              Ver
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`edit-${permission.id}`}
                              checked={permission.can_edit}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(permission.id, 'can_edit', checked)
                              }
                              disabled={role === 'super_admin' || !permission.can_view}
                            />
                            <Label htmlFor={`edit-${permission.id}`} className="text-sm">
                              Editar
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Guía rápida */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Guía de Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(roleLabels) as AppRole[]).map(role => (
              <div key={role} className="p-3 rounded-lg border bg-background">
                <Badge className="mb-2" variant={role === 'super_admin' ? 'destructive' : 'secondary'}>
                  {roleLabels[role]}
                </Badge>
                <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
