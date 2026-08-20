import { EquipoTabs } from "@/components/equipo/EquipoTabs";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { type AppRole } from "@/hooks/useRolePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Shield, User, Mail, Building2, Calendar, MoreHorizontal, Trash2, KeyRound, UserCircle, Sparkles, HelpCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExecuteMigrationDialog } from "@/components/admin/ExecuteMigrationDialog";
import { ApplyMigrationsButton } from "@/components/admin/ApplyMigrationsButton";

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
}

export default function Users() {
  const { isAdmin, isSuperAdmin, loading: profileLoading } = useProfile();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToReset, setUserToReset] = useState<string | null>(null);
  const [newUserRole, setNewUserRole] = useState<AppRole>('user');
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ userId: string; isCurrentlyAdmin: boolean; userName?: string; newRole?: string } | null>(null);

  // Fetch all users with their profiles and roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Get all clientes
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('user_id, empresa_nombre');

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
        description: 'Revisa la consola para más detalles',
      });
    },
  });

  // Create new user - Método simplificado y mejorado
  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!newUserEmail || !newUserPassword) {
        throw new Error('Email y contraseña son requeridos');
      }

      if (newUserPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUserEmail)) {
        throw new Error('El formato del email no es válido');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Debes estar autenticado para crear usuarios');

      // Verificar si el usuario ya existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id, email')
        .eq('email', newUserEmail.toLowerCase().trim())
        .maybeSingle();

      if (existingProfile) {
        throw new Error(`El usuario con email ${newUserEmail} ya existe en el sistema.`);
      }

      // Crear usuario directamente con signUp
      console.log('Creando usuario:', newUserEmail);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newUserEmail.toLowerCase().trim(),
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName || newUserEmail.split('@')[0],
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        }
      });

      if (signUpError) {
        console.error('Error en signUp:', signUpError);
        // Mensajes de error más amigables
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists') || signUpError.message.includes('User already registered')) {
          throw new Error(`El email ${newUserEmail} ya está registrado. El usuario puede iniciar sesión directamente.`);
        }
        if (signUpError.message.includes('Invalid email')) {
          throw new Error('El formato del email no es válido.');
        }
        if (signUpError.message.includes('Password')) {
          throw new Error('La contraseña no cumple con los requisitos de seguridad.');
        }
        throw new Error(signUpError.message || 'Error al crear el usuario. Intenta nuevamente.');
      }

      if (!signUpData.user) {
        throw new Error('No se pudo crear el usuario. Verifica la configuración de Supabase.');
      }

      const userId = signUpData.user.id;
      const fullName = newUserName || newUserEmail.split('@')[0];

      // Crear perfil (puede que ya exista por trigger, pero lo creamos/actualizamos por si acaso)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: newUserEmail.toLowerCase().trim(),
          full_name: fullName,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.warn('Advertencia al crear perfil (puede que ya exista):', profileError);
        // Continuar aunque falle, el trigger puede haberlo creado
      }

      // Asignar rol (esperar un poco para que el perfil se cree)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newUserRole,
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.warn('Advertencia al asignar rol:', roleError);
        // Continuar aunque falle
      }

      // Crear registro en clientes si no existe - need to provide all required fields
      const { error: clienteError } = await supabase
        .from('clientes')
        .upsert({
          email: newUserEmail.toLowerCase().trim(),
          empresa_nombre: newUserName || 'Sin nombre',
          nombre_responsable: newUserName || 'Sin nombre',
          region: 'Metropolitana',
          rut: '00.000.000-0',
          user_id: userId,
        }, {
          onConflict: 'user_id'
        });

      if (clienteError) {
        console.warn('Advertencia al crear cliente:', clienteError);
        // Continuar aunque falle
      }

      return {
        user: signUpData.user,
        message: 'Usuario creado exitosamente',
        emailConfirmed: !!signUpData.user.email_confirmed_at,
      };
    },
    onSuccess: (data: any) => {
      setIsAddUserOpen(false);
      const emailCreated = newUserEmail;
      const roleCreated = newUserRole;
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole('user');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        `✅ Usuario creado exitosamente${roleCreated === 'admin' ? ' como Administrador' : ''}`,
        {
          description: `${emailCreated} puede iniciar sesión ahora. ${data?.emailConfirmed ? 'Email confirmado automáticamente.' : 'Debe confirmar su email para iniciar sesión.'}`,
          duration: 6000,
        }
      );
    },
    onError: (error: Error) => {
      console.error('Error creating user:', error);
      const errorMessage = error.message || 'Error al crear usuario';
      
      // Mensajes más descriptivos y útiles
      let userMessage = errorMessage;
      let description = 'Revisa los datos e intenta nuevamente';
      
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists') || errorMessage.includes('ya está registrado')) {
        userMessage = 'El usuario ya existe';
        description = 'Este email ya está registrado. El usuario puede iniciar sesión directamente o puedes resetear su contraseña.';
      } else if (errorMessage.includes('Invalid email') || errorMessage.includes('formato del email')) {
        userMessage = 'Email inválido';
        description = 'Verifica que el email tenga un formato correcto (ejemplo: usuario@dominio.com)';
      } else if (errorMessage.includes('Password') || errorMessage.includes('contraseña')) {
        userMessage = 'Contraseña inválida';
        description = 'La contraseña debe tener al menos 6 caracteres';
      } else if (errorMessage.includes('autenticado')) {
        userMessage = 'Sesión expirada';
        description = 'Por favor, inicia sesión nuevamente';
      }
      
      toast.error(userMessage, {
        description: description,
        duration: 6000,
      });
    },
  });

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
          <h1 className="text-2xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los usuarios del sistema y sus permisos
          </p>
        </div>
        <div className="flex gap-2">
          <ApplyMigrationsButton />
          <ExecuteMigrationDialog />
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90 shadow-md">
              <UserPlus className="h-4 w-4" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-firmavb-blue/20 to-firmavb-red/10 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-firmavb-blue" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Crear Nuevo Usuario</DialogTitle>
                  <DialogDescription className="mt-1">
                    Completa los datos para crear un usuario y asignarle un rol
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              {/* Nombre Completo */}
              <div className="space-y-2">
                <Label htmlFor="user-name" className="flex items-center gap-2 text-sm font-medium">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  Nombre Completo
                </Label>
                <Input
                  id="user-name"
                  placeholder="Ej: Juan Pérez"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Opcional - Se usará el email si no se proporciona</p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="user-email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={newUserEmail}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().trim();
                    setNewUserEmail(value);
                  }}
                  required
                  className="h-11"
                  disabled={createUserMutation.isPending}
                />
                {newUserEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail) && (
                  <p className="text-xs text-destructive">El formato del email no es válido</p>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="user-password" className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Contraseña <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  className="h-11"
                  disabled={createUserMutation.isPending}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">El usuario podrá cambiarla después de iniciar sesión</p>
                  {newUserPassword && (
                    <p className={`text-xs ${newUserPassword.length >= 6 ? 'text-success' : 'text-destructive'}`}>
                      {newUserPassword.length}/6 caracteres
                    </p>
                  )}
                </div>
              </div>

              {/* Rol */}
              <div className="space-y-2">
                <Label htmlFor="user-role" className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Rol del Usuario
                </Label>
                <Select value={newUserRole} onValueChange={(value: AppRole) => setNewUserRole(value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue>
                      {newUserRole === 'super_admin' ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-destructive" />
                          <span>Super Admin</span>
                        </div>
                      ) : newUserRole === 'admin' ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-firmavb-blue" />
                          <span>Administrador</span>
                        </div>
                      ) : newUserRole === 'vendedor' ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span>Vendedor</span>
                        </div>
                      ) : newUserRole === 'visor' ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Visor</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Usuario</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">Usuario</div>
                          <div className="text-xs text-muted-foreground">Acceso básico al sistema</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-firmavb-blue/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-firmavb-blue" />
                        </div>
                        <div>
                          <div className="font-medium">Administrador</div>
                          <div className="text-xs text-muted-foreground">Gestión completa del sistema</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="vendedor" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">Vendedor</div>
                          <div className="text-xs text-muted-foreground">Enfocado en oportunidades y postulaciones</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="visor" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">Visor</div>
                          <div className="text-xs text-muted-foreground">Solo lectura de reportes</div>
                        </div>
                      </div>
                    </SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin" className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-destructive" />
                          </div>
                          <div>
                            <div className="font-medium">Super Admin</div>
                            <div className="text-xs text-muted-foreground">Acceso total y configuración de roles</div>
                          </div>
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-firmavb-blue/5 to-firmavb-red/5 border border-firmavb-blue/10">
                  <Sparkles className="h-4 w-4 text-firmavb-blue mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <strong className="text-foreground font-medium">💡 Tip:</strong>{' '}
                    <span className="text-muted-foreground">Puedes cambiar el rol después desde la lista de usuarios usando el switch</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddUserOpen(false);
                  setNewUserName("");
                  setNewUserEmail("");
                  setNewUserPassword("");
                  setNewUserRole('user');
                }}
                disabled={createUserMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => createUserMutation.mutate()}
                disabled={
                  createUserMutation.isPending || 
                  !newUserEmail || 
                  !newUserPassword || 
                  newUserPassword.length < 6 ||
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail)
                }
                className="bg-firmavb-blue hover:bg-firmavb-blue/90"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando usuario...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Usuario
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Usuarios</CardTitle>
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
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Lista de todos los usuarios del sistema con sus roles y permisos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => {
                const isUserAdmin = user.roles.some(r => r.role === 'admin');
                const initials = user.profile?.full_name
                  ? user.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : user.email.slice(0, 2).toUpperCase();

                return (
                  <TableRow key={user.id}>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {user.cliente?.empresa_nombre || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
