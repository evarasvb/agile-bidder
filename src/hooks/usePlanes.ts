import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Plan {
  id: string;
  nombre: string;
  descripcion?: string;
  precio_mensual: number;
  precio_anual?: number;
  features: string[];
  limite_licitaciones?: number;
  limite_ofertas?: number;
  limite_usuarios: number;
  tiene_auto_bid: boolean;
  tiene_bi_avanzado: boolean;
  tiene_api: boolean;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

// Hook: Listar todos los planes
export function usePlanes() {
  return useQuery({
    queryKey: ['planes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('planes')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });
      
      if (error) throw error;
      
      // Parse features from JSONB
      return (data as any[]).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]'),
      })) as Plan[];
    },
  });
}

// Hook: Obtener un plan específico
export function usePlan(id: string | null) {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await (supabase as any)
        .from('planes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return {
        ...data,
        features: Array.isArray(data.features) ? data.features : JSON.parse(data.features || '[]'),
      } as Plan;
    },
    enabled: !!id,
  });
}

// Hook: Obtener plan por nombre
export function usePlanByNombre(nombre: string) {
  return useQuery({
    queryKey: ['plan-nombre', nombre],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('planes')
        .select('*')
        .eq('nombre', nombre)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      
      return {
        ...data,
        features: Array.isArray(data.features) ? data.features : JSON.parse(data.features || '[]'),
      } as Plan;
    },
  });
}

// Hook: Comparar planes
export function useCompararPlanes() {
  return useQuery({
    queryKey: ['comparar-planes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('planes')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });
      
      if (error) throw error;

      const planes = (data as any[]).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]'),
      })) as Plan[];

      // Crear matriz de comparación
      const features = [
        { key: 'limite_licitaciones', label: 'Licitaciones/mes', format: (v: number | null) => v === null ? 'Ilimitadas' : v.toString() },
        { key: 'limite_ofertas', label: 'Ofertas/mes', format: (v: number | null) => v === null ? 'Ilimitadas' : v.toString() },
        { key: 'limite_usuarios', label: 'Usuarios', format: (v: number) => v.toString() },
        { key: 'tiene_auto_bid', label: 'Autocompletar cotización', format: (v: boolean) => v ? '✓' : '✗' },
        { key: 'tiene_bi_avanzado', label: 'BI Avanzado', format: (v: boolean) => v ? '✓' : '✗' },
        { key: 'tiene_api', label: 'Acceso API', format: (v: boolean) => v ? '✓' : '✗' },
      ];

      return { planes, features };
    },
  });
}

// Hook: Formatear precio
export function formatPrecio(precio: number): string {
  if (precio === 0) return 'Gratis';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(precio);
}

// Hook: Calcular ahorro anual
export function calcularAhorroAnual(precioMensual: number, precioAnual: number): number {
  const costoAnualSinDescuento = precioMensual * 12;
  return costoAnualSinDescuento - precioAnual;
}

// Hook: Verificar límites del plan
export function useVerificarLimitesPlan(planNombre: string) {
  const { data: plan } = usePlanByNombre(planNombre);
  
  return useQuery({
    queryKey: ['verificar-limites', planNombre],
    queryFn: async () => {
      if (!plan) return { dentroLimites: true, licitacionesUsadas: 0, ofertasUsadas: 0 };

      // Contar uso del mes actual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { count: licitacionesCount } = await (supabase as any)
        .from('licitaciones')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioMes.toISOString());

      const { count: ofertasCount } = await (supabase as any)
        .from('ofertas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioMes.toISOString());

      const licitacionesUsadas = licitacionesCount || 0;
      const ofertasUsadas = ofertasCount || 0;

      const dentroLimites = 
        (plan.limite_licitaciones === null || licitacionesUsadas < plan.limite_licitaciones) &&
        (plan.limite_ofertas === null || ofertasUsadas < plan.limite_ofertas);

      return {
        dentroLimites,
        licitacionesUsadas,
        ofertasUsadas,
        limiteLicitaciones: plan.limite_licitaciones,
        limiteOfertas: plan.limite_ofertas,
      };
    },
    enabled: !!plan,
  });
}
