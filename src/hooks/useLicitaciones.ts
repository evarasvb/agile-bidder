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

function validateLicitacionId(id: unknown): string {
  if (!id || typeof id !== 'string') {
    throw new Error('ID de licitación inválido');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('ID de licitación contiene caracteres inválidos');
  }
  
  if (id.length > 200) {
    throw new Error('ID de licitación excede longitud máxima');
  }
  
  return id;
}

interface CompraAgilRow {
  codigo: string;
  nombre: string;
  organismo: string;
  monto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  link_oficial: string | null;
  created_at: string;
  match_encontrado: boolean | null;
  match_score: number | null;
}

function mapCompraAgilToLicitacion(compra: CompraAgilRow): Licitacion {
  return {
    id_licitacion: compra.codigo || '',
    titulo: compra.nombre || 'Sin título',
    organismo: compra.organismo || '',
    presupuesto: compra.monto ?? null,
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
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        
        if (error) {
          console.error('Error obteniendo licitaciones:', error);
          throw new Error(`Error al obtener licitaciones: ${error.message}`);
        }
        
        return (data || []).map(mapCompraAgilToLicitacion);
      } catch (error) {
        console.error('Error en useLicitaciones:', error);
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useLicitacionesNuevas() {
  return useQuery({
    queryKey: ['licitaciones', 'nuevas'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .or('match_encontrado.eq.false,match_encontrado.is.null')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (error) {
          console.error('Error obteniendo licitaciones nuevas:', error);
          throw new Error(`Error al obtener licitaciones nuevas: ${error.message}`);
        }
        
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
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('*')
          .eq('match_encontrado', true)
          .order('match_score', { ascending: false })
          .limit(500);
        
        if (error) {
          console.error('Error obteniendo licitaciones con match:', error);
          throw new Error(`Error al obtener licitaciones con match: ${error.message}`);
        }
        
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
        const validId = validateLicitacionId(licitacionId);
        
        const { data: compra, error: fetchError } = await supabase
          .from('compras_agiles')
          .select('id, nombre, descripcion, organismo, monto')
          .eq('codigo', validId)
          .single();

        if (fetchError) {
          console.error('Error obteniendo compra ágil:', fetchError);
          throw new Error(`Error al obtener compra ágil: ${fetchError.message}`);
        }

        if (!compra) {
          throw new Error('Compra ágil no encontrada');
        }

        const titulo = (compra.nombre || '').slice(0, 500);
        const descripcion = (compra.descripcion || '').slice(0, 5000);

        // Cargar los ítems reales de la compra ágil (tabla correcta: compras_agiles_items)
        const { data: itemsCA } = await supabase
          .from('compras_agiles_items')
          .select('nombre_producto, descripcion, cantidad')
          .eq('compra_agil_id', compra.id);

        // Cargar el inventario activo del cliente para comparar
        const { data: inventario, error: invError } = await supabase
          .from('inventory')
          .select('id, sku, nombre_producto, descripcion, categoria, keywords, precio_unitario, stock_disponible')
          .eq('activo', true);

        if (invError) throw invError;
        if (!inventario || inventario.length === 0) {
          throw new Error('No hay productos en el inventario para comparar. Carga tu lista de precios primero.');
        }

        // Invocar matching-ai con el contrato correcto: { licitaciones[], inventario[] }
        const { data: matchResult, error: matchError } = await supabase.functions.invoke('matching-ai', {
          body: {
            licitaciones: [{
              id_licitacion: validId,
              titulo,
              descripcion,
              organismo: compra.organismo,
              presupuesto: compra.monto,
              items: (itemsCA || []).map((i: any) => ({
                nombre_producto: i.nombre_producto,
                descripcion: i.descripcion,
                cantidad: i.cantidad,
              })),
            }],
            inventario: inventario.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              nombre: p.nombre_producto,
              descripcion: p.descripcion,
              categoria: p.categoria,
              palabras_clave: p.keywords || [],
              precio_unitario: p.precio_unitario,
              stock: p.stock_disponible || 0,
            })),
          },
        });

        if (matchError) {
          console.error('Error en matching AI:', matchError);
          throw new Error(`Error en análisis de matching: ${matchError.message}`);
        }

        // Leer el score REAL que devuelve matching-ai (results[0].match_score).
        // Sin puntajes inventados: si no hay resultado válido, es un error explícito.
        const resultado = matchResult?.results?.[0];
        if (!resultado || typeof resultado.match_score !== 'number') {
          throw new Error('El análisis de matching no devolvió un resultado válido. Revisa la configuración de IA.');
        }
        const matchScore = Math.max(0, Math.min(100, resultado.match_score));
        const matchEncontrado = matchScore >= 50;
        
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
        const validId = validateLicitacionId(licitacionId);
        
        const { error } = await supabase
          .from('compras_agiles')
          .update({
            match_encontrado: false,
            match_score: null,
            updated_at: new Date().toISOString(),
          })
          .eq('codigo', validId);
        
        if (error) {
          console.error('Error rechazando licitación:', error);
          throw new Error(`Error al rechazar licitación: ${error.message}`);
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

export function useLicitacionItemsById(licitacionId: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];
      
      try {
        const validId = validateLicitacionId(licitacionId);
        
        const { data, error } = await supabase
          .from('licitacion_items')
          .select('*')
          .eq('licitacion_id', validId);
        
        if (error) {
          console.error('Error obteniendo items:', error);
          throw new Error(`Error al obtener items: ${error.message}`);
        }
        
        return (data || []) as LicitacionItem[];
      } catch (error) {
        console.error('Error en useLicitacionItemsById:', error);
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
