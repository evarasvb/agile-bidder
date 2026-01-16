import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
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
import { Loader2, UserPlus, Shield, User, Mail, Building2, Calendar, MoreHorizontal, Trash2, KeyRound, UserCircle, Sparkles, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExecuteMigrationDialog } from "@/components/admin/ExecuteMigrationDialog";

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  roles: { role: 'admin' | 'user' }[];
  cliente: {
    empresa_nombre: string | null;
    odoo_enabled: boolean;
  } | null;
}

export default function Users() {
  const { isAdmin, loading: profileLoading } = useProfile();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');

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
        .select('user_id, empresa_nombre, odoo_enabled');

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
          user.roles.push({ role: role.role as 'admin' | 'user' });
        }
      });

      clientes?.forEach(cliente => {
        if (cliente.user_id) {
          const user = usersMap.get(cliente.user_id);
          if (user) {
            user.cliente = {
              empresa_nombre: cliente.empresa_nombre,
              odoo_enabled: cliente.odoo_enabled || false,
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

  // Toggle Odoo enabled
  const toggleOdooMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      // Verificar si existe el registro en clientes
      const { data: existingCliente, error: checkError } = await supabase
        .from('clientes')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw checkError;
      }

      if (existingCliente) {
        // Actualizar si existe
        const { error } = await supabase
          .from('clientes')
          .update({ odoo_enabled: enabled })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        // Crear si no existe
        const { error } = await supabase
          .from('clientes')
          .insert({
            user_id: userId,
            empresa_nombre: null,
            odoo_enabled: enabled,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Configuración de Odoo actualizada');
    },
    onError: (error: any) => {
      console.error('Error toggling Odoo:', error);
      const errorMessage = error?.message || error?.error_description || 'Error al actualizar Odoo';
      toast.error(errorMessage);
      // Log detallado para debugging
      console.error('Error completo:', {
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        message: error?.message,
      });
    },
  });

  // Create new user
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

      // Intentar usar Edge Function primero, si falla usar método alternativo
      try {
        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: newUserEmail,
              password: newUserPassword,
              full_name: newUserName || newUserEmail.split('@')[0],
              role: newUserRole,
            }),
          }
        );

        if (response.ok) {
          return await response.json();
        }
        
        // Si la función no existe (404), usar método alternativo
        if (response.status === 404) {
          console.warn('Edge Function create-user no existe, usando método alternativo');
          throw new Error('EDGE_FUNCTION_NOT_FOUND');
        }

        const error = await response.json();
        throw new Error(error.error || `Error ${response.status}: ${response.statusText}`);
      } catch (error: any) {
        // Método alternativo: usar signUp y luego actualizar perfil/rol
        if (error.message === 'EDGE_FUNCTION_NOT_FOUND' || error.message?.includes('Failed to fetch')) {
          console.log('Usando método alternativo: signUp + actualizar perfil');
          
          // Crear usuario con signUp (requiere que el email no esté confirmado o usar auto-confirm)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: newUserEmail,
            password: newUserPassword,
            options: {
              data: {
                full_name: newUserName || newUserEmail.split('@')[0],
              },
              emailRedirectTo: window.location.origin,
            }
          });

          if (signUpError) {
            // Si el usuario ya existe, intentar actualizar
            if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
              throw new Error('El usuario ya existe. Usa "Actualizar" en lugar de crear.');
            }
            throw signUpError;
          }

          if (!signUpData.user) {
            throw new Error('No se pudo crear el usuario');
          }

          const userId = signUpData.user.id;

          // Crear/actualizar perfil
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              user_id: userId,
              email: newUserEmail,
              full_name: newUserName || newUserEmail.split('@')[0],
            }, {
              onConflict: 'user_id'
            });

          if (profileError) {
            console.error('Error creando perfil:', profileError);
            // Continuar aunque falle el perfil
          }

          // Asignar rol
          const { error: roleError } = await supabase
            .from('user_roles')
            .upsert({
              user_id: userId,
              role: newUserRole,
            }, {
              onConflict: 'user_id,role'
            });

          if (roleError) {
            console.error('Error asignando rol:', roleError);
            // Continuar aunque falle el rol
          }

          // Crear registro en clientes si no existe
          const { error: clienteError } = await supabase
            .from('clientes')
            .upsert({
              user_id: userId,
              empresa_nombre: null,
              odoo_enabled: false,
            }, {
              onConflict: 'user_id'
            });

          if (clienteError) {
            console.error('Error creando cliente:', clienteError);
            // Continuar aunque falle
          }

          return {
            user: signUpData.user,
            message: 'Usuario creado exitosamente'
          };
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
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
          description: `${emailCreated} puede iniciar sesión ahora`,
          duration: 4000,
        }
      );
    },
    onError: (error: Error) => {
      console.error('Error creating user:', error);
      const errorMessage = error.message || 'Error al crear usuario';
      
      // Mensajes más descriptivos
      let userMessage = errorMessage;
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
        userMessage = 'El usuario ya existe. Verifica el email o actualiza el usuario existente.';
      } else if (errorMessage.includes('Invalid email')) {
        userMessage = 'El formato del email no es válido.';
      } else if (errorMessage.includes('Password')) {
        userMessage = 'La contraseña no cumple los requisitos mínimos.';
      }
      
      toast.error(userMessage, {
        description: 'Revisa los datos e intenta nuevamente',
        duration: 5000,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los usuarios del sistema y sus permisos
          </p>
        </div>
        <div className="flex gap-2">
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
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="h-11"
                />
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
                />
                <p className="text-xs text-muted-foreground">El usuario podrá cambiarla después de iniciar sesión</p>
              </div>

              {/* Rol */}
              <div className="space-y-2">
                <Label htmlFor="user-role" className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Rol del Usuario
                </Label>
                <Select value={newUserRole} onValueChange={(value: 'admin' | 'user') => setNewUserRole(value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue>
                      {newUserRole === 'admin' ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-firmavb-blue" />
                          <span>Administrador</span>
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
                          <div className="text-xs text-muted-foreground">Acceso completo y gestión de usuarios</div>
                        </div>
                      </div>
                    </SelectItem>
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
                disabled={createUserMutation.isPending || !newUserEmail || !newUserPassword || newUserPassword.length < 6}
                className="bg-firmavb-blue hover:bg-firmavb-blue/90"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
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
              {users?.filter(u => u.roles.some(r => r.role === 'admin')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Con Odoo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter(u => u.cliente?.odoo_enabled).length || 0}
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
                <TableHead>Odoo</TableHead>
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
                              newRole: isUserAdmin ? 'user' : 'admin',
                              userName,
                            });
                          }}
                          disabled={toggleAdminMutation.isPending}
                          className="data-[state=checked]:bg-firmavb-blue"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.cliente ? (
                        <Switch
                          checked={user.cliente.odoo_enabled}
                          onCheckedChange={(enabled) => toggleOdooMutation.mutate({ 
                            userId: user.id, 
                            enabled 
                          })}
                          disabled={toggleOdooMutation.isPending}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin empresa</span>
                      )}
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
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
