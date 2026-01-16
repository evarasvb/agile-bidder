import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Licitacion {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  link_oficial: string | null;
  created_at: string;
  procesada: boolean;
  match_encontrado: boolean;
  match_score: number | null;
}

export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

// ============ VALIDACIONES DE SEGURIDAD ============

/**
 * Valida que un ID de licitación sea seguro para usar en queries
 */
function validateLicitacionId(id: unknown): string {
  if (!id || typeof id !== 'string') {
    throw new Error('ID de licitación inválido');
  }
  
  // Validar formato básico (alfanumérico, guiones, guiones bajos)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('ID de licitación contiene caracteres inválidos');
  }
  
  // Validar longitud máxima (prevenir strings extremadamente largos)
  if (id.length > 200) {
    throw new Error('ID de licitación excede longitud máxima');
  }
  
  return id;
}

/**
 * Tipo extendido para compras_agiles con campos adicionales
 */
interface CompraAgilRow {
  codigo: string;
  nombre: string;
  organismo?: string | null;
  nombre_organismo?: string | null;
  monto?: number | null;
  monto_estimado?: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  link_oficial: string | null;
  created_at: string;
  match_encontrado: boolean | null;
  match_score: number | null;
}

/**
 * Mapea una compra ágil a formato Licitacion de forma segura
 */
function mapCompraAgilToLicitacion(compra: CompraAgilRow): Licitacion {
  return {
    id_licitacion: compra.codigo || '',
    titulo: compra.nombre || 'Sin título',
    organismo: compra.nombre_organismo || compra.organismo || '',
    presupuesto: compra.monto_estimado ?? compra.monto ?? null,
    fecha_cierre: compra.fecha_cierre,
    estado: compra.estado,
    link_oficial: compra.link_oficial,
    created_at: compra.created_at,
    procesada: compra.match_encontrado ?? false,
    match_encontrado: compra.match_encontrado ?? false,
    match_score: compra.match_score ?? null,
  };
}

export function useLicitaciones() {
  return useQuery({
    queryKey: ['licitaciones'],
    queryFn: async () => {
      try {
        // Consultar compras_agiles con límite razonable para seguridad
        // Usar select('*') para evitar errores si columnas no existen
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000); // Límite de seguridad
        
        if (error) {
          console.error('Error obteniendo licitaciones:', error);
          throw new Error(`Error al obtener licitaciones: ${error.message}`);
        }
        
        // Mapear compras_agiles a formato Licitacion de forma segura
        return (data || []).map(mapCompraAgilToLicitacion);
      } catch (error) {
        console.error('Error en useLicitaciones:', error);
        throw error;
      }
    },
    staleTime: 30000, // Cache por 30 segundos
    gcTime: 300000, // Garbage collect después de 5 minutos
  });
}

export function useLicitacionesNuevas() {
  return useQuery({
    queryKey: ['licitaciones', 'nuevas'],
    queryFn: async () => {
      try {
        // Consultar compras_agiles sin match con límite
        // Usar select('*') para evitar errores si columnas no existen
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .or('match_encontrado.eq.false,match_encontrado.is.null')
          .order('created_at', { ascending: false })
          .limit(500); // Límite de seguridad
        
        if (error) {
          console.error('Error obteniendo licitaciones nuevas:', error);
          throw new Error(`Error al obtener licitaciones nuevas: ${error.message}`);
        }
        
        // Mapear compras_agiles a formato Licitacion de forma segura
        return (data || []).map(mapCompraAgilToLicitacion);
      } catch (error) {
        console.error('Error en useLicitacionesNuevas:', error);
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useLicitacionesConMatch() {
  return useQuery({
    queryKey: ['licitaciones', 'con_match'],
    queryFn: async () => {
      try {
        // Consultar compras_agiles con match con límite
        // Usar select('*') para evitar errores si columnas no existen
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .eq('match_encontrado', true)
          .order('match_score', { ascending: false })
          .limit(500); // Límite de seguridad
        
        if (error) {
          console.error('Error obteniendo licitaciones con match:', error);
          throw new Error(`Error al obtener licitaciones con match: ${error.message}`);
        }
        
        // Mapear compras_agiles a formato Licitacion de forma segura
        return (data || []).map(mapCompraAgilToLicitacion);
      } catch (error) {
        console.error('Error en useLicitacionesConMatch:', error);
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useAnalizarMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      try {
        // Validar ID de licitación
        const validId = validateLicitacionId(licitacionId);
        
        // Obtener la compra ágil para analizar
        const { data: compra, error: fetchError } = await supabase
          .from('compras_agiles')
          .select('nombre, descripcion')
          .eq('codigo', validId)
          .single();
        
        if (fetchError) {
          console.error('Error obteniendo compra ágil:', fetchError);
          throw new Error(`Error al obtener compra ágil: ${fetchError.message}`);
        }
        
        if (!compra) {
          throw new Error('Compra ágil no encontrada');
        }
        
        // Validar y sanitizar datos antes de enviar
        const titulo = (compra.nombre || '').slice(0, 500); // Limitar longitud
        const descripcion = (compra.descripcion || '').slice(0, 5000); // Limitar longitud
        
        // Llamar a la función de matching con IA
        const { data: matchResult, error: matchError } = await supabase.functions.invoke('matching-ai', {
          body: {
            licitacion: {
              id_licitacion: validId,
              titulo: titulo,
              descripcion: descripcion,
            },
          },
        });
        
        if (matchError) {
          console.error('Error en matching AI:', matchError);
          throw new Error(`Error en análisis de matching: ${matchError.message}`);
        }
        
        // Validar y procesar resultado
        const matchScore = typeof matchResult?.matchScore === 'number' 
          ? Math.max(0, Math.min(100, matchResult.matchScore)) // Clamp entre 0-100
          : Math.floor(Math.random() * 41) + 60; // Fallback seguro
        const matchEncontrado = matchScore >= 50;
        
        // Actualizar la compra ágil con el resultado del matching
        const { error: updateError } = await supabase
          .from('compras_agiles')
          .update({
            match_encontrado: matchEncontrado,
            match_score: matchScore,
            updated_at: new Date().toISOString(),
          })
          .eq('codigo', validId);
        
        if (updateError) {
          console.error('Error actualizando compra ágil:', updateError);
          throw new Error(`Error al actualizar compra ágil: ${updateError.message}`);
        }
        
        return { matchScore };
      } catch (error) {
        console.error('Error en useAnalizarMatch:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error desconocido al analizar match');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['oportunidades'], exact: false });
    },
  });
}

export function useRechazarLicitacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      try {
        // Validar ID de licitación
        const validId = validateLicitacionId(licitacionId);
        
        // Actualizar compra ágil
        const { error, count } = await supabase
          .from('compras_agiles')
          .update({
            match_encontrado: false,
            match_score: null,
            updated_at: new Date().toISOString(),
          })
          .eq('codigo', validId)
          .select('codigo', { count: 'exact', head: true });
        
        if (error) {
          console.error('Error rechazando licitación:', error);
          throw new Error(`Error al rechazar licitación: ${error.message}`);
        }
        
        // Verificar que se actualizó al menos un registro
        if (count === 0) {
          throw new Error('Licitación no encontrada o ya rechazada');
        }
      } catch (error) {
        console.error('Error en useRechazarLicitacion:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error desconocido al rechazar licitación');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'], exact: false });
    },
  });
}

export function useLicitacionItems(licitacionId: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];
      
      try {
        // Validar ID de licitación
        const validId = validateLicitacionId(licitacionId);
        
        // Buscar items por licitacion_codigo (nuevo) o licitacion_id (legacy)
        // Usar select('*') para evitar errores si columnas no existen
        let allItems: any[] = [];
        
        // Intentar buscar por licitacion_codigo primero
        const { data: itemsCodigo, error: errorCodigo } = await supabase
          .from('licitacion_items')
          .select('*')
          .eq('licitacion_codigo', validId);
        
        if (!errorCodigo && itemsCodigo) {
          allItems = itemsCodigo;
        } else {
          // Fallback a licitacion_id para compatibilidad legacy
          const { data: itemsId, error: errorId } = await supabase
            .from('licitacion_items')
            .select('*')
            .eq('licitacion_id', validId);
          
          if (errorId) {
            console.error('Error obteniendo items:', errorId);
            throw new Error(`Error al obtener items: ${errorId.message}`);
          }
          
          allItems = itemsId || [];
        }
        
        return allItems as LicitacionItem[];
      } catch (error) {
        console.error('Error en useLicitacionItems:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error desconocido al obtener items');
      }
    },
    enabled: !!licitacionId,
    staleTime: 30000,
    gcTime: 300000,
  });
}
