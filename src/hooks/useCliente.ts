import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';

// Tipos
export interface Cliente {
  id: string;
  user_id: string;
  email: string;
  empresa_nombre: string;
  rut: string;
  nombre_responsable: string;
  region: string;
  telefono?: string;
  direccion?: string;
  logo_url?: string;
  odoo_url?: string;
  odoo_db?: string;
  odoo_user?: string;
  odoo_api_key?: string;
  categoria_negocio?: string;
  industrias?: string[];
  palabras_clave_busqueda?: string[];
  plan: string;
  activo: boolean;
  onboarding_completado: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface ClienteInventario {
  id: string;
  cliente_id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  precio_unitario: number;
  margen_minimo: number;
  stock: number;
  tiempo_entrega_dias: number;
  palabras_clave?: string[];
  activo: boolean;
  imagen_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ClienteExclusion {
  id: string;
  cliente_id: string;
  producto_excluido: string;
  created_at: string;
}

export interface ClienteNotificaciones {
  id: string;
  cliente_id: string;
  email_instantaneo: boolean;
  resumen_diario: boolean;
  resumen_semanal: boolean;
  push_notifications: boolean;
  webhook_url?: string;
  presupuesto_minimo: number;
  created_at: string;
  updated_at: string;
}

// Hook for current authenticated user
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, isAuthenticated: !!user };
}

// Hook para el cliente actual basado en autenticación
export function useCliente() {
  const { user, loading: authLoading } = useAuthUser();

  return useQuery({
    queryKey: ['cliente', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Find cliente by user_id (auth.uid())
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) return data as Cliente;

      // Cliente nuevo sin fila todavía: creamos una mínima para que el onboarding
      // (y el resto de la app) tengan un cliente con el que trabajar.
      const { data: creado, error: insError } = await supabase
        .from('clientes')
        // Cast: los tipos generados exigen rut/region/nombre_responsable, pero en
        // la BD son nulos; sólo sembramos lo mínimo del usuario nuevo.
        .insert({
          user_id: user.id,
          email: user.email ?? '',
          empresa_nombre: user.email?.split('@')[0] || 'Mi empresa',
        } as any)
        .select()
        .single();

      if (insError) {
        // Posible carrera (otra pestaña lo creó): reintentamos el select.
        const { data: retry } = await supabase
          .from('clientes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        return (retry as Cliente) ?? null;
      }

      // Registro de notificaciones por defecto (mejor esfuerzo).
      await supabase.from('cliente_notificaciones').insert({ cliente_id: creado.id });
      return creado as Cliente;
    },
    enabled: !authLoading && !!user,
  });
}

// Resuelve la empresa DUEÑA del usuario (la propia si es dueño; la que lo invitó
// si es miembro de equipo). Úsalo donde la identidad de la EMPRESA importa (p. ej.
// el PDF de cotización que se sube a postular), no el `clientes` auto-creado que
// useCliente() genera para cada usuario. Ver función SQL cliente_owner_id().
export function useClienteOwner() {
  const { user, loading: authLoading } = useAuthUser();

  return useQuery({
    queryKey: ['cliente-owner', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: ownerId, error } = await (supabase as any).rpc('cliente_owner_id');
      if (error || !ownerId) return null;
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', ownerId as string)
        .maybeSingle();
      return (data as Cliente) ?? null;
    },
    enabled: !authLoading && !!user,
  });
}

// Hook para registrar cliente
export function useRegistrarCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthUser();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      empresa_nombre: string;
      rut: string;
      nombre_responsable: string;
      region: string;
      telefono?: string;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      // Use the authenticated user's email and ID
      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert({ 
          ...data, 
          email: user.email || data.email,
          user_id: user.id 
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Crear registro de notificaciones por defecto
      await supabase
        .from('cliente_notificaciones')
        .insert({ cliente_id: cliente.id });
      
      return cliente as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente'] });
      toast({
        title: '¡Registro exitoso!',
        description: 'Bienvenido a FirmaVB',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al registrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para actualizar cliente
export function useActualizarCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Cliente> & { id: string }) => {
      const { error } = await supabase
        .from('clientes')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para inventario del cliente
export function useClienteInventario() {
  const { data: cliente } = useCliente();

  return useQuery({
    queryKey: ['cliente-inventario', cliente?.id],
    queryFn: async () => {
      if (!cliente?.id) return [];
      
      const { data, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ClienteInventario[];
    },
    enabled: !!cliente?.id,
  });
}

// Hook para cargar TODOS los productos del inventario (sin filtro de cliente)
export function useTodoElInventario() {
  return useQuery({
    queryKey: ['todo-inventario'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      return data as ClienteInventario[];
    },
  });
}

// Hook para agregar producto al inventario
export function useAgregarProducto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<ClienteInventario, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('cliente_inventario')
        .insert(data);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      toast({
        title: 'Producto agregado',
        description: 'El producto se ha agregado al inventario',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al agregar producto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para actualizar producto
export function useActualizarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ClienteInventario> & { id: string }) => {
      const { error } = await supabase
        .from('cliente_inventario')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['todo-inventario'] });
    },
  });
}

// Hook para eliminar producto
export function useEliminarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cliente_inventario')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['todo-inventario'] });
    },
  });
}

// Hook para exclusiones
export function useClienteExclusiones() {
  const { data: cliente } = useCliente();

  return useQuery({
    queryKey: ['cliente-exclusiones', cliente?.id],
    queryFn: async () => {
      if (!cliente?.id) return [];

      // Cast a any: los tipos generados aún traen la columna antigua
      // `tipo_exclusion`; la real es `producto_excluido`.
      const { data, error } = await (supabase as any)
        .from('cliente_exclusiones')
        .select('*')
        .eq('cliente_id', cliente.id);

      if (error) throw error;
      return (data as ClienteExclusion[]) ?? [];
    },
    enabled: !!cliente?.id,
  });
}

// Hook para toggle exclusión
export function useToggleExclusion() {
  const queryClient = useQueryClient();
  const { data: cliente } = useCliente();

  const key = ['cliente-exclusiones', cliente?.id];

  return useMutation({
    mutationFn: async (tipoExclusion: string) => {
      if (!cliente?.id) throw new Error('No hay cliente');

      // Verificar si existe (maybeSingle: 0 filas no es error). Cast a any: los
      // tipos generados aún traen la columna antigua `tipo_exclusion`.
      const { data: existing } = await (supabase as any)
        .from('cliente_exclusiones')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('producto_excluido', tipoExclusion)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from('cliente_exclusiones')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('cliente_exclusiones')
          .insert({ cliente_id: cliente.id, producto_excluido: tipoExclusion });
        if (error) throw error;
      }
    },
    // Optimista: la tarjeta se marca/desmarca al instante (sin esperar al server).
    onMutate: async (tipoExclusion: string) => {
      if (!cliente?.id) return { prev: undefined as any };
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ClienteExclusion[]>(key);
      queryClient.setQueryData<ClienteExclusion[]>(key, (old = []) => {
        const existe = old.some((e) => e.producto_excluido === tipoExclusion);
        return existe
          ? old.filter((e) => e.producto_excluido !== tipoExclusion)
          : [...old, { id: `temp-${tipoExclusion}`, cliente_id: cliente.id, producto_excluido: tipoExclusion, created_at: new Date().toISOString() }];
      });
      return { prev };
    },
    onError: (_err, _tipo, context: any) => {
      if (context?.prev !== undefined) queryClient.setQueryData(key, context.prev);
      toast.error('No se pudo guardar la preferencia. Intenta de nuevo.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-exclusiones'] });
    },
  });
}

// Hook para notificaciones
export function useClienteNotificaciones() {
  const { data: cliente } = useCliente();

  return useQuery({
    queryKey: ['cliente-notificaciones', cliente?.id],
    queryFn: async () => {
      if (!cliente?.id) return null;
      
      const { data, error } = await supabase
        .from('cliente_notificaciones')
        .select('*')
        .eq('cliente_id', cliente.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ClienteNotificaciones | null;
    },
    enabled: !!cliente?.id,
  });
}

// Hook para actualizar notificaciones
export function useActualizarNotificaciones() {
  const queryClient = useQueryClient();
  const { data: cliente } = useCliente();

  return useMutation({
    mutationFn: async (data: Partial<ClienteNotificaciones>) => {
      if (!cliente?.id) throw new Error('No hay cliente');

      const { error } = await supabase
        .from('cliente_notificaciones')
        .update(data)
        .eq('cliente_id', cliente.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-notificaciones'] });
    },
  });
}

// Validar RUT chileno
export function validarRUT(rut: string): boolean {
  // Limpiar RUT
  const rutClean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  
  if (rutClean.length < 2) return false;
  
  const body = rutClean.slice(0, -1);
  const dv = rutClean.slice(-1);
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDV = 11 - (sum % 11);
  const dvString = expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : expectedDV.toString();
  
  return dv === dvString;
}

// Formatear RUT
export function formatearRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  // Agregar puntos
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formatted}-${dv}`;
}

// Legacy functions for backwards compatibility - will be deprecated
// These should eventually be removed as components are updated to use auth
export function getClienteId(): string | null {
  console.warn('getClienteId() is deprecated. Use useCliente() hook instead.');
  return localStorage.getItem('cliente_id');
}

export function setClienteId(id: string): void {
  console.warn('setClienteId() is deprecated. Use Supabase auth instead.');
  localStorage.setItem('cliente_id', id);
}

export function clearClienteId(): void {
  console.warn('clearClienteId() is deprecated. Use Supabase auth signOut instead.');
  localStorage.removeItem('cliente_id');
}
