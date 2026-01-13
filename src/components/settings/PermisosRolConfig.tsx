import { useState, useEffect } from 'react';
import { useRolePermissions, type RolePermission, type AppRole } from '@/hooks/useRolePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  user: 'Usuario',
  vendedor: 'Vendedor',
  visor: 'Visor',
};

const roleOrder: AppRole[] = ['super_admin', 'admin', 'user', 'vendedor', 'visor'];

interface PermissionMatrix {
  [sectionKey: string]: {
    sectionName: string;
    roles: {
      [role: string]: {
        id: string;
        can_view: boolean;
        can_edit: boolean;
        can_delete: boolean;
      };
    };
  };
}

export default function PermisosRolConfig() {
  const { isSuperAdmin, loading: roleLoading } = useRolePermissions();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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

  // Construir matriz de permisos
  const buildPermissionMatrix = (): PermissionMatrix => {
    const matrix: PermissionMatrix = {};
    
    permissions.forEach(p => {
      if (!matrix[p.section_key]) {
        matrix[p.section_key] = {
          sectionName: p.section_name,
          roles: {},
        };
      }
      matrix[p.section_key].roles[p.role] = {
        id: p.id,
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: (p as any).can_delete ?? false,
      };
    });
    
    return matrix;
  };

  const handlePermissionChange = async (
    permissionId: string, 
    role: AppRole,
    field: 'can_view' | 'can_edit' | 'can_delete', 
    value: boolean
  ) => {
    if (role === 'super_admin') {
      toast.error('No se pueden modificar los permisos de Super Admin');
      return;
    }

    setSaving(permissionId + field);

    // Optimistic update
    setPermissions(prev => 
      prev.map(p => p.id === permissionId ? { ...p, [field]: value } : p)
    );

    try {
      const updateData: any = { [field]: value, updated_at: new Date().toISOString() };
      
      // Si desactiva can_view, también desactivar can_edit y can_delete
      if (field === 'can_view' && !value) {
        updateData.can_edit = false;
        updateData.can_delete = false;
        setPermissions(prev => 
          prev.map(p => p.id === permissionId ? { ...p, can_view: false, can_edit: false } : p)
        );
      }

      const { error } = await supabase
        .from('role_permissions')
        .update(updateData)
        .eq('id', permissionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Error al actualizar permiso');
      fetchAllPermissions();
    } finally {
      setSaving(null);
    }
  };

  const matrix = buildPermissionMatrix();
  const sections = Object.keys(matrix).sort();

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Solo los Super Admins pueden configurar permisos de roles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Matriz de Permisos por Rol</h3>
          <p className="text-sm text-muted-foreground">
            Define qué puede ver, editar y eliminar cada rol
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px] font-semibold">Sección</TableHead>
                  {roleOrder.map(role => (
                    <TableHead key={role} className="text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          variant={role === 'super_admin' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {roleLabels[role]}
                        </Badge>
                        {role === 'super_admin' && (
                          <span className="text-xs text-muted-foreground">No editable</span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map(sectionKey => {
                  const section = matrix[sectionKey];
                  return (
                    <TableRow key={sectionKey}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{section.sectionName}</p>
                          <p className="text-xs text-muted-foreground">{sectionKey}</p>
                        </div>
                      </TableCell>
                      {roleOrder.map(role => {
                        const rolePerms = section.roles[role];
                        if (!rolePerms) return <TableCell key={role} className="text-center">-</TableCell>;
                        
                        const isSuperAdmin = role === 'super_admin';
                        const isLoading = (field: string) => saving === rolePerms.id + field;
                        
                        return (
                          <TableCell key={role} className="text-center">
                            <div className="flex flex-col items-center gap-2">
                              {/* Ver */}
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`view-${rolePerms.id}`}
                                  checked={rolePerms.can_view}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(rolePerms.id, role, 'can_view', !!checked)
                                  }
                                  disabled={isSuperAdmin || isLoading('can_view')}
                                  className="h-4 w-4"
                                />
                                <label 
                                  htmlFor={`view-${rolePerms.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Ver
                                </label>
                              </div>
                              {/* Editar */}
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`edit-${rolePerms.id}`}
                                  checked={rolePerms.can_edit}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(rolePerms.id, role, 'can_edit', !!checked)
                                  }
                                  disabled={isSuperAdmin || !rolePerms.can_view || isLoading('can_edit')}
                                  className="h-4 w-4"
                                />
                                <label 
                                  htmlFor={`edit-${rolePerms.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Editar
                                </label>
                              </div>
                              {/* Eliminar */}
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`delete-${rolePerms.id}`}
                                  checked={rolePerms.can_delete}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(rolePerms.id, role, 'can_delete', !!checked)
                                  }
                                  disabled={isSuperAdmin || !rolePerms.can_view || isLoading('can_delete')}
                                  className="h-4 w-4"
                                />
                                <label 
                                  htmlFor={`delete-${rolePerms.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Eliminar
                                </label>
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Guía de Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roleOrder.map(role => (
              <div key={role} className="flex items-start gap-2 p-2 rounded-lg border bg-background">
                <Badge 
                  variant={role === 'super_admin' ? 'destructive' : 'secondary'}
                  className="shrink-0"
                >
                  {roleLabels[role]}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {role === 'super_admin' && 'Acceso total, no editable'}
                  {role === 'admin' && 'Gestión completa del sistema'}
                  {role === 'user' && 'Usuario estándar'}
                  {role === 'vendedor' && 'Enfocado en ventas'}
                  {role === 'visor' && 'Solo lectura'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
