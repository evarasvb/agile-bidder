import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface ProductoMatch {
  producto_id: string;
  sku: string;
  nombre: string;
  score: number;
  razon: string;
}

interface MatchResult {
  licitacion_id: string;
  match_score: number;
  productos_match: ProductoMatch[];
  razon_general: string;
  recomendacion: 'ofertar' | 'revisar' | 'descartar';
}

interface MatchingResponse {
  results: MatchResult[];
  error?: string;
}

// Hook para ejecutar el motor de matching con IA
export function useMatchingAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<MatchingResponse> => {
      // 1. Cargar licitaciones no procesadas
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, organismo, presupuesto')
        .eq('procesada', false)
        .limit(10);

      if (licError) throw licError;
      if (!licitaciones || licitaciones.length === 0) {
        return { results: [], error: 'No hay licitaciones nuevas para procesar' };
      }

      // 2. Cargar items de cada licitación
      const licitacionesConItems = await Promise.all(
        licitaciones.map(async (lic) => {
          const { data: items } = await supabase
            .from('licitacion_items')
            .select('nombre_producto, descripcion, cantidad')
            .eq('licitacion_id', lic.id_licitacion);

          return {
            ...lic,
            items: items || []
          };
        })
      );

      // 3. Cargar inventario (tabla inventory que tiene los productos)
      const { data: inventario, error: invError } = await supabase
        .from('inventory')
        .select('id, sku, nombre_producto, descripcion, categoria, keywords, precio_unitario, stock_disponible')
        .eq('activo', true);

      if (invError) throw invError;
      if (!inventario || inventario.length === 0) {
        return { results: [], error: 'No hay productos en el inventario' };
      }

      // 4. Llamar a la edge function de matching
      const { data, error } = await supabase.functions.invoke('matching-ai', {
        body: {
          licitaciones: licitacionesConItems,
          inventario: inventario.map(p => ({
            id: p.id,
            sku: p.sku,
            nombre: p.nombre_producto,
            descripcion: p.descripcion,
            categoria: p.categoria,
            palabras_clave: p.keywords || [],
            precio_unitario: p.precio_unitario,
            stock: p.stock_disponible || 0
          }))
        }
      });

      if (error) {
        console.error('Matching AI error:', error);
        throw error;
      }

      const response = data as MatchingResponse;

      // 5. Actualizar licitaciones con resultados
      for (const result of response.results) {
        if (result.match_score >= 40) {
          await supabase
            .from('licitaciones')
            .update({
              procesada: true,
              match_encontrado: true,
              match_score: result.match_score
            })
            .eq('id_licitacion', result.licitacion_id);
        } else {
          await supabase
            .from('licitaciones')
            .update({
              procesada: true,
              match_encontrado: false,
              match_score: result.match_score
            })
            .eq('id_licitacion', result.licitacion_id);
        }
      }

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
      queryClient.invalidateQueries({ queryKey: ['licitaciones-nuevas'] });
      queryClient.invalidateQueries({ queryKey: ['licitaciones-con-match'] });

      const matchCount = data.results.filter(r => r.match_score >= 50).length;
      if (matchCount > 0) {
        toast.success(`✨ ${matchCount} licitaciones con match encontradas`, {
          description: 'Se actualizaron los scores usando IA'
        });
      } else if (data.results.length > 0) {
        toast.info('Análisis completado', {
          description: 'No se encontraron matches significativos'
        });
      }
    },
    onError: (error) => {
      console.error('Matching failed:', error);
      toast.error('Error en el motor de matching', {
        description: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
}

// Hook que ejecuta el matching automáticamente cuando hay licitaciones nuevas
export function useAutoMatching() {
  const { mutate: runMatching, isPending } = useMatchingAI();
  const hasRunRef = useRef(false);

  // Query para detectar licitaciones no procesadas
  const { data: licitacionesNuevas } = useQuery({
    queryKey: ['licitaciones-sin-procesar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitaciones')
        .select('id_licitacion')
        .eq('procesada', false)
        .limit(1);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Revisar cada 30 segundos
  });

  // Ejecutar matching cuando hay licitaciones nuevas
  useEffect(() => {
    if (licitacionesNuevas && licitacionesNuevas.length > 0 && !isPending && !hasRunRef.current) {
      console.log('🔄 Detectadas licitaciones nuevas, ejecutando matching automático...');
      hasRunRef.current = true;
      runMatching();
    }
    
    // Reset flag when no new licitaciones
    if (licitacionesNuevas?.length === 0) {
      hasRunRef.current = false;
    }
  }, [licitacionesNuevas, isPending, runMatching]);

  return { 
    isProcessing: isPending,
    pendingCount: licitacionesNuevas?.length || 0,
    runMatching 
  };
}

// Hook para obtener el resultado de matching de una licitación específica
export function useMatchingResult(licitacionId: string | null) {
  return useQuery({
    queryKey: ['matching-result', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return null;

      const { data, error } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, match_encontrado, match_score')
        .eq('id_licitacion', licitacionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!licitacionId,
  });
}