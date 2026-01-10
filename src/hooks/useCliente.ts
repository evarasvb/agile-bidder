import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Helper para obtener/crear cliente ID en localStorage
export function getClienteId(): string | null {
  return localStorage.getItem('cliente_id');
}

export function setClienteId(id: string): void {
  localStorage.setItem('cliente_id', id);
}

export function clearClienteId(): void {
  localStorage.removeItem('cliente_id');
}

// Tipos
export interface Cliente {
  id: string;
  email: string;
  empresa_nombre: string;
  rut: string;
  nombre_responsable: string;
  region: string;
  telefono?: string;
  categoria_negocio?: string;
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
  created_at: string;
  updated_at: string;
}

export interface ClienteExclusion {
  id: string;
  cliente_id: string;
  tipo_exclusion: string;
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

// Hook para el cliente actual
export function useCliente() {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (error) throw error;
      return data as Cliente;
    },
    enabled: !!clienteId,
  });
}

// Hook para registrar cliente
export function useRegistrarCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      empresa_nombre: string;
      rut: string;
      nombre_responsable: string;
      region: string;
      telefono?: string;
    }) => {
      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      
      // Guardar ID en localStorage
      setClienteId(cliente.id);
      
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
        description: 'Bienvenido a LicitaBot',
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
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-inventario', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ClienteInventario[];
    },
    enabled: !!clienteId,
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
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-exclusiones', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('cliente_exclusiones')
        .select('*')
        .eq('cliente_id', clienteId);
      
      if (error) throw error;
      return data as ClienteExclusion[];
    },
    enabled: !!clienteId,
  });
}

// Hook para toggle exclusión
export function useToggleExclusion() {
  const queryClient = useQueryClient();
  const clienteId = getClienteId();

  return useMutation({
    mutationFn: async (tipoExclusion: string) => {
      if (!clienteId) throw new Error('No hay cliente');

      // Verificar si existe
      const { data: existing } = await supabase
        .from('cliente_exclusiones')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('tipo_exclusion', tipoExclusion)
        .single();

      if (existing) {
        // Eliminar
        await supabase
          .from('cliente_exclusiones')
          .delete()
          .eq('id', existing.id);
      } else {
        // Agregar
        await supabase
          .from('cliente_exclusiones')
          .insert({ cliente_id: clienteId, tipo_exclusion: tipoExclusion });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-exclusiones'] });
    },
  });
}

// Hook para notificaciones
export function useClienteNotificaciones() {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-notificaciones', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      
      const { data, error } = await supabase
        .from('cliente_notificaciones')
        .select('*')
        .eq('cliente_id', clienteId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ClienteNotificaciones | null;
    },
    enabled: !!clienteId,
  });
}

// Hook para actualizar notificaciones
export function useActualizarNotificaciones() {
  const queryClient = useQueryClient();
  const clienteId = getClienteId();

  return useMutation({
    mutationFn: async (data: Partial<ClienteNotificaciones>) => {
      if (!clienteId) throw new Error('No hay cliente');

      const { error } = await supabase
        .from('cliente_notificaciones')
        .update(data)
        .eq('cliente_id', clienteId);
      
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
