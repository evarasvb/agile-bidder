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
      // 1. Cargar compras ágiles no procesadas
      const { data: comprasAgiles, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo, nombre, organismo, monto, descripcion')
        .or('match_encontrado.eq.false,match_encontrado.is.null')
        .limit(10);

      if (caError) throw caError;
      
      // También cargar licitaciones legacy si existen
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, organismo, presupuesto')
        .eq('procesada', false)
        .limit(10);

      if (licError) throw licError;
      
      // Combinar ambas fuentes
      const todasLicitaciones = [
        ...(comprasAgiles || []).map(ca => ({
          id_licitacion: ca.codigo,
          titulo: ca.nombre,
          organismo: ca.organismo,
          presupuesto: ca.monto,
          descripcion: ca.descripcion,
        })),
        ...(licitaciones || []),
      ];
      
      if (todasLicitaciones.length === 0) {
        return { results: [], error: 'No hay compras ágiles nuevas para procesar' };
      }

      // 2. Cargar items de las licitaciones
      const codigosLicitaciones = todasLicitaciones.map(lic => lic.id_licitacion);
      
      const { data: todosItems, error: itemsError } = await supabase
        .from('licitacion_items')
        .select('licitacion_id, nombre_producto, descripcion, cantidad')
        .in('licitacion_id', codigosLicitaciones);
      
      if (itemsError) {
        console.warn('Error obteniendo items (continuando sin items):', itemsError);
      }
      
      // Crear mapa de items por licitación
      const itemsMap = new Map<string, typeof todosItems>();
      (todosItems || []).forEach(item => {
        const codigo = item.licitacion_id;
        if (codigo) {
          if (!itemsMap.has(codigo)) {
            itemsMap.set(codigo, []);
          }
          itemsMap.get(codigo)!.push(item);
        }
      });
      
      // Asignar items a cada licitación
      const licitacionesConItems = todasLicitaciones.map(lic => ({
        ...lic,
        items: itemsMap.get(lic.id_licitacion) || []
      }));

      // 3. Cargar inventario
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

      // 5. Actualizar compras ágiles con resultados
      const codigosCA = new Set((comprasAgiles || []).map(ca => ca.codigo));
      
      for (const result of response.results) {
        const matchEncontrado = result.match_score >= 40;
        
        if (codigosCA.has(result.licitacion_id)) {
          await supabase
            .from('compras_agiles')
            .update({
              match_encontrado: matchEncontrado,
              match_score: result.match_score
            })
            .eq('codigo', result.licitacion_id);
        } else {
          await supabase
            .from('licitaciones')
            .update({
              procesada: true,
              match_encontrado: matchEncontrado,
              match_score: result.match_score
            })
            .eq('id_licitacion', result.licitacion_id);
        }
      }

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['licitaciones'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['oportunidades'], exact: false });
      
      const matchCount = data.results.filter(r => r.match_score >= 50).length;
      if (matchCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['licitaciones-con-match'] });
        queryClient.invalidateQueries({ queryKey: ['compras_agiles_stats'] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['licitaciones-sin-procesar'] });

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

  const { data: licitacionesNuevas } = useQuery({
    queryKey: ['licitaciones-sin-procesar'],
    queryFn: async () => {
      const { data: comprasAgiles, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo')
        .or('match_encontrado.eq.false,match_encontrado.is.null')
        .limit(1);

      if (caError) {
        console.warn('Error consultando compras_agiles:', caError);
      }
      
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion')
        .eq('procesada', false)
        .limit(1);

      if (licError) {
        console.warn('Error consultando licitaciones:', licError);
      }
      
      return [
        ...(comprasAgiles || []).map(ca => ({ id_licitacion: ca.codigo })),
        ...(licitaciones || []),
      ];
    },
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 60000,
  });

  useEffect(() => {
    if (licitacionesNuevas && licitacionesNuevas.length > 0 && !isPending && !hasRunRef.current) {
      console.log('🔄 Detectadas licitaciones nuevas, ejecutando matching automático...');
      hasRunRef.current = true;
      runMatching();
    }
    
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

      const { data: compraAgil, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo, nombre, match_encontrado, match_score')
        .eq('codigo', licitacionId)
        .maybeSingle();

      if (!caError && compraAgil) {
        return {
          id_licitacion: compraAgil.codigo,
          titulo: compraAgil.nombre,
          match_encontrado: compraAgil.match_encontrado ?? false,
          match_score: compraAgil.match_score ?? null,
        };
      }

      const { data, error } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, match_encontrado, match_score')
        .eq('id_licitacion', licitacionId)
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo matching result:', error);
        throw error;
      }
      
      return data ? {
        ...data,
        match_encontrado: data.match_encontrado ?? false,
        match_score: data.match_score ?? null,
      } : null;
    },
    enabled: !!licitacionId,
    staleTime: 30000,
    gcTime: 120000,
  });
}
