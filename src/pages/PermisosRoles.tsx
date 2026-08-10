import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRolePermissions, type RolePermission, type AppRole } from '@/hooks/useRolePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Save, Loader2, AlertCircle, Check, X, Eye, Edit, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

const roleColors: Record<AppRole, string> = {
  super_admin: 'destructive',
  admin: 'default',
  user: 'secondary',
  vendedor: 'outline',
  visor: 'outline',
};

// Todas las secciones del sistema
const ALL_SECTIONS = [
  { key: 'dashboard', name: 'Dashboard', description: 'Panel principal con métricas' },
  { key: 'licitaciones', name: 'Licitaciones', description: 'Ver y gestionar licitaciones' },
  { key: 'compras_agiles', name: 'Compras Ágiles', description: 'Gestión de compras ágiles' },
  { key: 'ordenes_compra', name: 'Órdenes de Compra', description: 'Ver órdenes de compra' },
  { key: 'ofertas', name: 'Mis Ofertas', description: 'Gestionar ofertas enviadas' },
  { key: 'vendedores', name: 'Gestión Vendedores', description: 'Administrar equipo de ventas' },
  { key: 'mercadopublico', name: 'MercadoPúblico', description: 'Acceso a MercadoPúblico' },
  { key: 'bi_dashboard', name: 'BI Dashboard', description: 'Dashboard de Business Intelligence' },
  { key: 'bi_advanced', name: 'BI Avanzado', description: 'Análisis avanzado de datos' },
  { key: 'calendar', name: 'Calendario', description: 'Calendario de eventos y vencimientos' },
  { key: 'inventory', name: 'Inventario', description: 'Gestionar productos e inventario' },
  { key: 'extension', name: 'Extensión Chrome', description: 'Configuración de extensión' },
  { key: 'history', name: 'Historial', description: 'Historial de acciones' },
  { key: 'settings', name: 'Configuración', description: 'Configuración del sistema' },
  { key: 'users', name: 'Usuarios', description: 'Gestión de usuarios' },
  { key: 'logs', name: 'Logs', description: 'Registros del sistema' },
  { key: 'role_config', name: 'Configurar Roles', description: 'Configuración de permisos' },
];

const roleOrder: AppRole[] = ['super_admin', 'admin', 'user', 'vendedor', 'visor'];

export default function PermisosRoles() {
  const { isSuperAdmin, loading: roleLoading } = useRolePermissions();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');
  const [hasChanges, setHasChanges] = useState(false);
  const [localPermissions, setLocalPermissions] = useState<Map<string, RolePermission>>(new Map());

  // Fetch all permissions
  const { data: permissions = [], isLoading, refetch } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('section_key', { ascending: true });

      if (error) throw error;
      return (data || []) as RolePermission[];
    },
  });

  // Initialize local permissions
  useEffect(() => {
    if (permissions.length > 0) {
      const map = new Map<string, RolePermission>();
      permissions.forEach(p => {
        map.set(`${p.role}-${p.section_key}`, p);
      });
      setLocalPermissions(map);
      setHasChanges(false);
    }
  }, [permissions]);

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ permissionId, updates }: { permissionId: string; updates: Partial<RolePermission> }) => {
      const { error } = await supabase
        .from('role_permissions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', permissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      setHasChanges(false);
      toast.success('Permiso actualizado');
    },
    onError: (error: any) => {
      console.error('Error updating permission:', error);
      toast.error('Error al actualizar permiso');
      refetch();
    },
  });

  // Batch update permissions
  const batchUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; updates: Partial<RolePermission> }>) => {
      // Update all permissions in parallel
      const promises = updates.map(({ id, updates: updateData }) =>
        supabase
          .from('role_permissions')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error('Algunos permisos no se pudieron actualizar');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      setHasChanges(false);
      toast.success('Permisos actualizados correctamente');
    },
    onError: (error: any) => {
      console.error('Error updating permissions:', error);
      toast.error('Error al actualizar permisos');
      refetch();
    },
  });

  const handlePermissionChange = (
    sectionKey: string,
    role: AppRole,
    field: 'can_view' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    if (role === 'super_admin') {
      toast.error('No se pueden modificar los permisos de Super Admin');
      return;
    }

    const key = `${role}-${sectionKey}`;
    const existing = localPermissions.get(key);

    if (!existing) {
      toast.error('Permiso no encontrado');
      return;
    }

    // Update local state
    const updated: RolePermission = {
      ...existing,
      [field]: value,
    };

    // Si desactiva can_view, también desactivar can_edit y can_delete
    if (field === 'can_view' && !value) {
      updated.can_edit = false;
      updated.can_delete = false;
    }

    // Si desactiva can_edit, también desactivar can_delete
    if (field === 'can_edit' && !value) {
      updated.can_delete = false;
    }

    setLocalPermissions(prev => {
      const newMap = new Map(prev);
      newMap.set(key, updated);
      return newMap;
    });

    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const updates: Array<{ id: string; updates: Partial<RolePermission> }> = [];

    localPermissions.forEach((perm, key) => {
      const original = permissions.find(p => p.id === perm.id);
      if (original && (
        original.can_view !== perm.can_view ||
        original.can_edit !== perm.can_edit ||
        (original.can_delete ?? false) !== (perm.can_delete ?? false)
      )) {
        updates.push({
          id: perm.id,
          updates: {
            can_view: perm.can_view,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete ?? false,
          },
        });
      }
    });

    if (updates.length === 0) {
      toast.info('No hay cambios para guardar');
      return;
    }

    batchUpdateMutation.mutate(updates);
  };

  const handleReset = () => {
    const map = new Map<string, RolePermission>();
    permissions.forEach(p => {
      map.set(`${p.role}-${p.section_key}`, p);
    });
    setLocalPermissions(map);
    setHasChanges(false);
    toast.info('Cambios descartados');
  };

  const getPermission = (sectionKey: string, role: AppRole): RolePermission | null => {
    return localPermissions.get(`${role}-${sectionKey}`) || null;
  };

  if (roleLoading || isLoading) {
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
            No tienes permisos para acceder a esta sección. Solo los Super Admins pueden configurar roles y permisos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-firmavb-blue/20 to-firmavb-red/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-firmavb-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Roles y Permisos</h1>
            <p className="text-sm text-muted-foreground">
              Define qué puede ver, editar y eliminar cada tipo de usuario
            </p>
          </div>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={batchUpdateMutation.isPending}>
              Descartar
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={batchUpdateMutation.isPending}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90"
            >
              {batchUpdateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Role Tabs */}
      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          {roleOrder.map(role => (
            <TabsTrigger
              key={role}
              value={role}
              disabled={role === 'super_admin'}
              className="text-xs sm:text-sm"
            >
              <div className="flex flex-col items-center gap-1">
                <span>{roleLabels[role]}</span>
                {role === 'super_admin' && (
                  <span className="text-[10px] text-muted-foreground">No editable</span>
                )}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {roleOrder.map(role => (
          <TabsContent key={role} value={role} className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {roleLabels[role]}
                      <Badge variant={roleColors[role] as any}>
                        {role === 'super_admin' ? 'Acceso Total' : 'Configurable'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {roleDescriptions[role]}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[250px] font-semibold">Sección</TableHead>
                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">Ver</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">Editar</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">Eliminar</span>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_SECTIONS.map(section => {
                        const permission = getPermission(section.key, role);
                        const isSuperAdmin = role === 'super_admin';
                        const canView = permission?.can_view ?? false;
                        const canEdit = permission?.can_edit ?? false;
                        const canDelete = permission?.can_delete ?? false;

                        return (
                          <TableRow key={section.key}>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <p className="font-medium">{section.name}</p>
                                      <p className="text-xs text-muted-foreground">{section.key}</p>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{section.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={canView}
                                onCheckedChange={(checked) =>
                                  handlePermissionChange(section.key, role, 'can_view', checked)
                                }
                                disabled={isSuperAdmin}
                                className="data-[state=checked]:bg-firmavb-blue"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={canEdit}
                                onCheckedChange={(checked) =>
                                  handlePermissionChange(section.key, role, 'can_edit', checked)
                                }
                                disabled={isSuperAdmin || !canView}
                                className="data-[state=checked]:bg-firmavb-blue"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={canDelete}
                                onCheckedChange={(checked) =>
                                  handlePermissionChange(section.key, role, 'can_delete', checked)
                                }
                                disabled={isSuperAdmin || !canView || !canEdit}
                                className="data-[state=checked]:bg-firmavb-blue"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info Card */}
      <Card className="bg-muted/30 border-firmavb-blue/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-firmavb-blue" />
            Información sobre Permisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Ver:</p>
                <p className="text-muted-foreground">El usuario puede acceder y ver el contenido de esta sección</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Edit className="h-5 w-5 text-firmavb-blue shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Editar:</p>
                <p className="text-muted-foreground">El usuario puede modificar y crear nuevos registros (requiere "Ver")</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Eliminar:</p>
                <p className="text-muted-foreground">El usuario puede eliminar registros (requiere "Ver" y "Editar")</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-muted-foreground">
                <strong>Nota:</strong> Los permisos de Super Admin no se pueden modificar ya que tienen acceso total al sistema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
