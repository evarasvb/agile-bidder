import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserSettings } from './useUserSettings';
import { esRegionActiva } from '@/utils/regiones';
import type { Database } from '@/integrations/supabase/types';

// Tipo base de la BD con campos adicionales de migraciones
type CompraAgilRow = Database['public']['Tables']['compras_agiles']['Row'] & {
  nombre_organismo?: string | null;
  monto_estimado?: number | null;
  buen_pagador?: boolean | null;
};

export interface CompraAgil {
  id: string;
  codigo: string;
  nombre: string;
  organismo: string; // Mapeado desde nombre_organismo
  monto: number | null; // Mapeado desde monto_estimado
  fecha_cierre: string | null;
  estado: string | null;
  region: string | null;
  descripcion: string | null;
  link_oficial: string | null;
  match_encontrado: boolean;
  match_score: number | null;
  buen_pagador: boolean | null;
  datos_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Campos reales de la BD
  nombre_organismo?: string | null;
  monto_estimado?: number | null;
}

export interface ComprasAgilesFilters {
  estado?: string;
  region?: string;
  montoMin?: number;
  montoMax?: number;
}

export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  const { data: userSettings } = useUserSettings();
  
  return useQuery({
    queryKey: ['compras_agiles', filters, userSettings?.regiones_config, userSettings?.regions],
    queryFn: async () => {
      let query = supabase
        .from('compras_agiles')
        .select('*')
        .order('fecha_cierre', { ascending: true });

      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.region && filters.region !== 'todas') {
        query = query.eq('region', filters.region);
      }

      if (filters?.montoMin) {
        query = query.gte('monto_estimado', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('monto_estimado', filters.montoMax);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filtrar datos de prueba/inventados antes de mapear
      const datosReales = (data || []).filter((compra) => {
        const nombreOrganismo = (compra as CompraAgilRow).nombre_organismo || compra.organismo || '';
        const nombre = compra.nombre || '';
        const codigo = compra.codigo || '';
        
        // Excluir si tiene nombres/códigos genéricos de prueba
        const nombreLower = nombre.toLowerCase();
        const organismoLower = nombreOrganismo.toLowerCase();
        const codigoLower = codigo.toLowerCase();
        
        // Patrones sospechosos - códigos de prueba comunes
        const esPrueba = 
          // Códigos de prueba típicos (CA-2025-XXX, TEST-XXX, etc.)
          /^CA-202[0-9]-/.test(codigo) || // CA-2025-001, CA-2024-123, etc.
          /^TEST-/.test(codigo) ||
          /^PRUEBA-/.test(codigo) ||
          /^DEMO-/.test(codigo) ||
          /^SAMPLE-/.test(codigo) ||
          codigoLower === 'test' ||
          codigoLower === 'prueba' ||
          codigoLower === 'demo' ||
          codigoLower === 'sample' ||
          // Nombres de prueba
          nombreLower.includes('test') ||
          nombreLower.includes('prueba') ||
          nombreLower.includes('ejemplo') ||
          nombreLower.includes('dummy') ||
          nombreLower.includes('sample') ||
          nombreLower.includes('demo') ||
          // Organismos de prueba
          organismoLower.includes('test') ||
          organismoLower.includes('prueba') ||
          organismoLower.includes('ejemplo') ||
          organismoLower === 'organismo no especificado' ||
          organismoLower === 'organismo de prueba' ||
          // Código debe ser alfanumérico o con guiones, y NO debe parecer de prueba
          (codigo && !/^[0-9A-Z-]+$/.test(codigo));
        
        return !esPrueba;
      });
      
      // Mapear campos de BD a interfaz
      let compras = datosReales.map((compra): CompraAgil => {
        const compraRow = compra as CompraAgilRow;
        // Convertir datos_json de Json a Record<string, unknown>
        const datosJson = compraRow.datos_json;
        const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
          ? datosJson as Record<string, unknown>
          : null;
        
        return {
          ...compra,
          organismo: compraRow.nombre_organismo || compraRow.organismo || '',
          monto: compraRow.monto_estimado ?? compraRow.monto ?? null,
          match_encontrado: compraRow.match_encontrado ?? false,
          match_score: compraRow.match_score ?? null,
          buen_pagador: compraRow.buen_pagador ?? null,
          nombre_organismo: compraRow.nombre_organismo ?? null,
          monto_estimado: compraRow.monto_estimado ?? null,
          datos_json: datosJsonRecord,
        };
      });
      
      // Filtrar por regiones activas del usuario (si está configurado)
      if (userSettings && (userSettings.regiones_config?.length > 0 || userSettings.regions?.length > 0)) {
        compras = compras.filter(compra => {
          if (!compra.region) return true; // Si no tiene región, mostrar
          return esRegionActiva(
            compra.region,
            userSettings.regiones_config || [],
            userSettings.regions || []
          );
        });
      }
      
      return compras;
    },
    refetchInterval: 30000,
  });
}

export function useCompraAgil(id: string | null) {
  return useQuery({
    queryKey: ['compra_agil', id],
    queryFn: async (): Promise<CompraAgil | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      const compraRow = data as CompraAgilRow;
      // Convertir datos_json de Json a Record<string, unknown>
      const datosJson = compraRow.datos_json;
      const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
        ? datosJson as Record<string, unknown>
        : null;
      return {
        ...data,
        organismo: compraRow.nombre_organismo || compraRow.organismo || '',
        monto: compraRow.monto_estimado ?? compraRow.monto ?? null,
        match_encontrado: compraRow.match_encontrado ?? false,
        match_score: compraRow.match_score ?? null,
        buen_pagador: compraRow.buen_pagador ?? null,
        nombre_organismo: compraRow.nombre_organismo ?? null,
        monto_estimado: compraRow.monto_estimado ?? null,
        datos_json: datosJsonRecord,
      };
    },
    enabled: !!id,
  });
}

export function useUpdateCompraAgil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, datos_json }: { id: string; datos_json: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('compras_agiles')
        .update({ datos_json: datos_json as unknown as import('@/integrations/supabase/types').Json })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
      queryClient.invalidateQueries({ queryKey: ['compra_agil'] });
    },
  });
}

export function useComprasAgilesStats() {
  return useQuery({
    queryKey: ['compras_agiles_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*');

      if (error) throw error;

      // Filtrar datos de prueba ANTES de mapear (mismo filtro que useComprasAgiles)
      const datosReales = (data || []).filter((compra) => {
        const nombreOrganismo = (compra as CompraAgilRow).nombre_organismo || compra.organismo || '';
        const nombre = compra.nombre || '';
        const codigo = compra.codigo || '';
        
        const nombreLower = nombre.toLowerCase();
        const organismoLower = nombreOrganismo.toLowerCase();
        const codigoLower = codigo.toLowerCase();
        
        const esPrueba = 
          /^CA-202[0-9]-/.test(codigo) ||
          /^TEST-/.test(codigo) ||
          /^PRUEBA-/.test(codigo) ||
          /^DEMO-/.test(codigo) ||
          /^SAMPLE-/.test(codigo) ||
          codigoLower === 'test' ||
          codigoLower === 'prueba' ||
          codigoLower === 'demo' ||
          codigoLower === 'sample' ||
          nombreLower.includes('test') ||
          nombreLower.includes('prueba') ||
          nombreLower.includes('ejemplo') ||
          nombreLower.includes('dummy') ||
          nombreLower.includes('sample') ||
          nombreLower.includes('demo') ||
          organismoLower.includes('test') ||
          organismoLower.includes('prueba') ||
          organismoLower.includes('ejemplo') ||
          organismoLower === 'organismo no especificado' ||
          organismoLower === 'organismo de prueba' ||
          (codigo && !/^[0-9A-Z-]+$/.test(codigo));
        
        return !esPrueba;
      });

      const compras = datosReales.map((c): CompraAgil => {
        const compraRow = c as CompraAgilRow;
        // Convertir datos_json de Json a Record<string, unknown>
        const datosJson = compraRow.datos_json;
        const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
          ? datosJson as Record<string, unknown>
          : null;
        
        return {
          ...c,
          organismo: compraRow.nombre_organismo || compraRow.organismo || '',
          monto: compraRow.monto_estimado ?? compraRow.monto ?? null,
          match_encontrado: compraRow.match_encontrado ?? false,
          match_score: compraRow.match_score ?? null,
          buen_pagador: compraRow.buen_pagador ?? null,
          nombre_organismo: compraRow.nombre_organismo ?? null,
          monto_estimado: compraRow.monto_estimado ?? null,
          datos_json: datosJsonRecord,
        };
      });
      
      const total = compras.length;
      const conMatch = compras.filter(c => c.match_encontrado).length;
      const urgentes = compras.filter(c => c.estado === 'urgente').length;
      const montoTotal = compras.reduce((sum, c) => sum + (c.monto || 0), 0);

      return {
        total,
        conMatch,
        urgentes,
        montoTotal,
      };
    },
  });
}
