import { EquipoTabs } from "@/components/equipo/EquipoTabs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { type AppRole } from "@/hooks/useRolePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Loader2, UserPlus, Shield, User, Mail, MoreHorizontal, Trash2, KeyRound, UserCircle, Sparkles, RotateCcw, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExecuteMigrationDialog } from "@/components/admin/ExecuteMigrationDialog";
import { ApplyMigrationsButton } from "@/components/admin/ApplyMigrationsButton";
import { useInvitarMiembro } from "@/hooks/useEquipo";

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  roles: { role: AppRole }[];
  cliente: {
    empresa_nombre: string | null;
  } | null;
  /** Invitación enviada (fila en `vendedores`) que la persona todavía no activó
   *  (nunca creó su contraseña): no tiene user_id, así que no es una cuenta real
   *  todavía. Antes estas filas se descartaban en silencio y quedaban invisibles
   *  en esta pantalla (hallazgo de Evaristo: invitó a Eva Bahamonde y no aparecía
   *  en "Roles y permisos", aunque la invitación sí se había creado). */
  pendiente?: { vendedorNombre: string; vendedorRol: string };
}

export default function Users() {
  const { isAdmin, isSuperAdmin, loading: profileLoading } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToReset, setUserToReset] = useState<string | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ userId: string; isCurrentlyAdmin: boolean; userName?: string; newRole?: string } | null>(null);
  const invitarMutation = useInvitarMiembro();

  // Solo MI equipo: yo (dueño) + los miembros que invité. La tabla `vendedores`
  // ya viene acotada por RLS a la empresa del usuario actual, así que NO se
  // filtran usuarios de otras empresas (antes se leían todos los profiles).
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const myId = authUser?.id ?? null;

      // Roster del equipo (RLS: solo mi empresa).
      const { data: equipo, error: equipoError } = await supabase
        .from('vendedores')
        .select('user_id, nombre, email, rol, estado_invitacion, invited_at, created_at');
      if (equipoError) throw equipoError;

      const ids = Array.from(new Set(
        [myId, ...(equipo ?? []).map((v: { user_id: string | null }) => v.user_id)]
          .filter((x): x is string => !!x)
      ));
      // Invitaciones enviadas que la persona nunca activó (sin user_id todavía):
      // se listan aparte porque no tienen profile/roles/cliente que combinar.
      const pendientes = (equipo ?? []).filter((v) => !v.user_id && v.estado_invitacion === 'pendiente');
      if (ids.length === 0 && pendientes.length === 0) return [];

      // Solo los profiles/roles/clientes de mi equipo.
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', ids);
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', ids);
      if (rolesError) throw rolesError;

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('user_id, empresa_nombre')
        .in('user_id', ids);
      if (clientesError) throw clientesError;

      // Combine data
      const usersMap = new Map<string, UserWithProfile>();

      profiles?.forEach(profile => {
        usersMap.set(profile.user_id, {
          id: profile.user_id,
          email: profile.email || '',
          created_at: profile.created_at,
          profile: {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          },
          roles: [],
          cliente: null,
        });
      });

      roles?.forEach(role => {
        const user = usersMap.get(role.user_id);
        if (user) {
          user.roles.push({ role: role.role as AppRole });
        }
      });

      clientes?.forEach(cliente => {
        if (cliente.user_id) {
          const user = usersMap.get(cliente.user_id);
          if (user) {
            user.cliente = {
              empresa_nombre: cliente.empresa_nombre,
            };
          }
        }
      });

      pendientes.forEach((v) => {
        usersMap.set(`pendiente-${v.email}`, {
          id: `pendiente-${v.email}`,
          email: v.email,
          created_at: v.invited_at || v.created_at,
          profile: { full_name: v.nombre, avatar_url: null },
          roles: [],
          cliente: null,
          pendiente: { vendedorNombre: v.nombre, vendedorRol: v.rol || 'vendedor' },
        });
      });

      return Array.from(usersMap.values());
    },
    enabled: isAdmin,
  });

  // Toggle admin role
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyAdmin }: { userId: string; isCurrentlyAdmin: boolean }) => {
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const newRole = variables.isCurrentlyAdmin ? 'Usuario' : 'Administrador';
      toast.success(`Rol actualizado: ${newRole}`, {
        description: `El usuario ahora tiene permisos de ${newRole.toLowerCase()}`,
      });
      setConfirmRoleChange(null);
    },
    onError: (error: any) => {
      console.error('Error toggling admin:', error);
      const errorMessage = error?.message || error?.error_description || 'Error al actualizar el rol';
      toast.error(errorMessage);
      // Log full error for debugging
      console.error('Full error details:', {
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        message: error?.message,
      });
    },
  });

  // Reset user password
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const redirectUrl = `${window.location.origin}/auth?reset=true`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
    },
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToReset(null);
      toast.success('Email de recuperación enviado', {
        description: `Se envió un email a ${email} para resetear la contraseña`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      console.error('Error resetting password:', error);
      const errorMessage = error?.message || 'Error al enviar email de recuperación';
      toast.error(errorMessage);
    },
  });

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Primero eliminar de tablas relacionadas (CASCADE debería hacerlo automáticamente, pero por seguridad)
      
      // Eliminar roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (rolesError) {
        console.warn('Error eliminando roles:', rolesError);
        // Continuar aunque falle
      }

      // Eliminar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);
      
      if (profileError) {
        console.warn('Error eliminando perfil:', profileError);
        // Continuar aunque falle
      }

      // Eliminar cliente
      const { error: clienteError } = await supabase
        .from('clientes')
        .delete()
        .eq('user_id', userId);
      
      if (clienteError) {
        console.warn('Error eliminando cliente:', clienteError);
        // Continuar aunque falle
      }

      // Finalmente eliminar el usuario de auth.users usando Admin API
      // Nota: Esto requiere permisos de admin en Supabase
      // Como no tenemos acceso directo desde el cliente, usaremos una Edge Function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Debes estar autenticado');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/delete-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          }
        );

        if (!response.ok) {
          // Si la función no existe, solo eliminamos los datos relacionados
          if (response.status === 404) {
            console.warn('Edge Function delete-user no existe. Solo se eliminaron datos relacionados.');
            toast.warning('Usuario desactivado', {
              description: 'Los datos relacionados fueron eliminados. El usuario debe ser eliminado manualmente desde Supabase Dashboard.',
            });
            return;
          }
          const error = await response.json();
          throw new Error(error.error || `Error ${response.status}`);
        }

        return await response.json();
      } catch (error: any) {
        // Si falla, al menos eliminamos los datos relacionados
        if (error.message?.includes('Failed to fetch') || error.message?.includes('404')) {
          console.warn('No se pudo eliminar de auth.users, pero se eliminaron datos relacionados');
          throw new Error('PARTIAL_DELETE');
        }
        throw error;
      }
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToDelete(null);
      toast.success('Usuario eliminado', {
        description: 'El usuario y todos sus datos han sido eliminados del sistema',
        duration: 5000,
      });
    },
    onError: (error: any, userId) => {
      console.error('Error deleting user:', error);
      if (error.message === 'PARTIAL_DELETE') {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        setUserToDelete(null);
        // Ya mostramos el warning en el mutationFn
        return;
      }
      const errorMessage = error?.message || 'Error al eliminar usuario';
      toast.error(errorMessage, {
        description: 'Intenta de nuevo; si persiste, escríbenos por el chat de Don Evaristo.',
      });
    },
  });

  const esAdmin = (user: UserWithProfile) => user.roles.some((r) => r.role === 'admin');

  const columnasUsuarios: DataTableColumn<UserWithProfile>[] = [
    {
      id: 'usuario',
      header: 'Usuario',
      sortValue: (user) => user.profile?.full_name || user.email,
      exportValue: (user) => `${user.profile?.full_name || 'Sin nombre'} <${user.email}>`,
      cell: (user) => {
        const initials = user.profile?.full_name
          ? user.profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
          : user.email.slice(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.profile?.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.profile?.full_name || 'Sin nombre'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'empresa',
      header: 'Empresa',
      sortValue: (user) => user.cliente?.empresa_nombre,
      exportValue: (user) => user.cliente?.empresa_nombre ?? '',
      cell: (user) => user.cliente?.empresa_nombre || <span className="text-muted-foreground">-</span>,
    },
    {
      id: 'rol',
      header: 'Rol',
      sortValue: (user) => (user.pendiente ? 'Pendiente' : esAdmin(user) ? 'Admin' : 'Usuario'),
      cell: (user) => {
        if (user.pendiente) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help border-amber-300 bg-amber-50 text-amber-700">
                  <Clock className="h-3 w-3 mr-1" />
                  Invitación pendiente
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Se le envió la invitación pero todavía no crea su contraseña ni entra a la app. No tiene rol asignado hasta que active la cuenta.
                </p>
              </TooltipContent>
            </Tooltip>
          );
        }
        const isUserAdmin = esAdmin(user);
        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={isUserAdmin ? "default" : "secondary"} className="cursor-help">
                  {isUserAdmin ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      Usuario
                    </>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {isUserAdmin
                    ? 'Administrador: Acceso completo al sistema y gestión de usuarios'
                    : 'Usuario: Acceso básico al sistema'}
                </p>
              </TooltipContent>
            </Tooltip>
            <Switch
              checked={isUserAdmin}
              onCheckedChange={() => {
                const userName = user.profile?.full_name || user.email;
                setConfirmRoleChange({
                  userId: user.id,
                  isCurrentlyAdmin: isUserAdmin,
                  newRole: isUserAdmin ? 'user' : 'admin',
                  userName,
                });
              }}
              disabled={toggleAdminMutation.isPending}
              className="data-[state=checked]:bg-firmavb-blue"
            />
          </div>
        );
      },
    },
    {
      id: 'registro',
      header: 'Registro',
      className: 'text-sm text-muted-foreground',
      sortValue: (user) => user.created_at,
      exportValue: (user) => format(new Date(user.created_at), 'dd-MM-yyyy'),
      cell: (user) => format(new Date(user.created_at), 'dd MMM yyyy', { locale: es }),
    },
    {
      id: 'acciones',
      header: '',
      headerClassName: 'w-[50px]',
      cell: (user) => {
        if (user.pendiente) {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-blue-600 hover:text-blue-700"
              disabled={invitarMutation.isPending}
              onClick={() =>
                invitarMutation.mutate({
                  nombre: user.pendiente!.vendedorNombre,
                  email: user.email,
                  rol: user.pendiente!.vendedorRol,
                })
              }
            >
              {invitarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Reenviar invitación
            </Button>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Acciones del usuario">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-50">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setUserToReset(user.email);
                }}
                className="cursor-pointer focus:bg-muted"
              >
                <RotateCcw className="h-4 w-4 mr-2 text-blue-600" />
                <span>Resetear Contraseña</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setUserToDelete(user.id);
                }}
                className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Eliminar Usuario</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acceso Restringido</h2>
        <p className="text-muted-foreground">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <EquipoTabs />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Roles y permisos de mi equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los roles, permisos y contraseñas de los miembros de tu equipo
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <>
              <ApplyMigrationsButton />
              <ExecuteMigrationDialog />
            </>
          )}
          <Button variant="outline" className="gap-2" onClick={() => navigate('/equipo')}>
            <UserPlus className="h-4 w-4" />
            Invitar miembro
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Miembros del equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{users?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter(u => u.roles.some(r => r.role === 'admin' || r.role === 'super_admin')).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros de tu equipo</CardTitle>
          <CardDescription>
            Los miembros que invitaste a tu empresa, con sus roles y permisos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<UserWithProfile>
            storageKey="admin-usuarios"
            rows={users ?? []}
            rowKey={(user) => user.id}
            columns={columnasUsuarios}
            itemLabel="usuarios"
            searchText={(user) => `${user.profile?.full_name ?? ''} ${user.email} ${user.cliente?.empresa_nombre ?? ''} ${esAdmin(user) ? 'admin' : 'usuario'}`}
            searchPlaceholder="Buscar por nombre, correo o empresa…"
            defaultSort={{ id: 'registro', dir: 'desc' }}
            exportFileName="usuarios-registrados"
            emptyMessage="No hay usuarios registrados"
          />
        </CardContent>
      </Card>

      {/* Confirm Reset Password Dialog */}
      <AlertDialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resetear contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un email a <strong>{userToReset}</strong> con un enlace para crear una nueva contraseña.
              <br />
              <br />
              <span className="text-blue-600 dark:text-blue-400">
                ℹ️ El usuario podrá ingresar con su nueva contraseña después de hacer clic en el enlace del email.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToReset) {
                  resetPasswordMutation.mutate(userToReset);
                }
              }}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Enviar Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete && (() => {
                const user = users?.find(u => u.id === userToDelete);
                return (
                  <>
                    Estás a punto de eliminar permanentemente a <strong>{user?.profile?.full_name || user?.email}</strong>.
                    <br />
                    <br />
                    <span className="text-destructive font-semibold">
                      ⚠️ Esta acción no se puede deshacer. Se eliminarán:
                    </span>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Cuenta de usuario</li>
                      <li>Perfil y datos personales</li>
                      <li>Roles y permisos</li>
                      <li>Datos de empresa/cliente</li>
                      <li>Inventario asociado</li>
                    </ul>
                    <br />
                    <span className="text-amber-600 dark:text-amber-400">
                      💡 Alternativa: Puedes resetear la contraseña en lugar de eliminar el usuario.
                    </span>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (userToDelete) {
                  const user = users?.find(u => u.id === userToDelete);
                  setUserToDelete(null);
                  setUserToReset(user?.email || null);
                }
              }}
              className="mr-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Mejor resetear contraseña
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (userToDelete) {
                  deleteUserMutation.mutate(userToDelete);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Permanentemente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Role Change Dialog */}
      <AlertDialog open={!!confirmRoleChange} onOpenChange={(open) => !open && setConfirmRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar rol de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRoleChange && (
                <>
                  Estás a punto de cambiar el rol de <strong>{confirmRoleChange.userName}</strong> a{' '}
                  <strong>{confirmRoleChange.newRole === 'admin' ? 'Administrador' : 'Usuario'}</strong>.
                  <br />
                  <br />
                  {confirmRoleChange.newRole === 'admin' ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      ⚠️ Los administradores tienen acceso completo al sistema, incluyendo gestión de usuarios y configuración.
                    </span>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400">
                      ℹ️ El usuario tendrá acceso básico y no podrá gestionar otros usuarios.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRoleChange) {
                  toggleAdminMutation.mutate({
                    userId: confirmRoleChange.userId,
                    isCurrentlyAdmin: confirmRoleChange.newRole === 'user',
                  });
                }
              }}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90"
              disabled={toggleAdminMutation.isPending}
            >
              {toggleAdminMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Confirmar Cambio'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
