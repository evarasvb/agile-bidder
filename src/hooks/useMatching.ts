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

      // 2. Cargar items de todas las licitaciones en una sola query (optimizado)
      const codigosLicitaciones = todasLicitaciones.map(lic => lic.id_licitacion);
      
      // Query única para todos los items usando licitacion_codigo (nuevo) o licitacion_id (legacy)
      const { data: todosItemsCodigo, error: itemsErrorCodigo } = await supabase
        .from('licitacion_items')
        .select('licitacion_codigo, licitacion_id, nombre_producto, descripcion, cantidad, item_index')
        .in('licitacion_codigo', codigosLicitaciones);
      
      // También buscar por licitacion_id para compatibilidad legacy
      const { data: todosItemsId, error: itemsErrorId } = await supabase
        .from('licitacion_items')
        .select('licitacion_codigo, licitacion_id, nombre_producto, descripcion, cantidad, item_index')
        .in('licitacion_id', codigosLicitaciones);
      
      // Combinar resultados y eliminar duplicados
      const todosItems = [
        ...(todosItemsCodigo || []),
        ...(todosItemsId || []).filter(item => 
          !todosItemsCodigo?.some(cItem => 
            cItem.licitacion_codigo === item.licitacion_codigo && 
            cItem.item_index === item.item_index
          )
        )
      ];
      
      if (itemsErrorCodigo && itemsErrorId) {
        console.warn('Error obteniendo items (continuando sin items):', itemsErrorCodigo, itemsErrorId);
      }
      
      // Crear mapa de items por licitación para búsqueda O(1)
      const itemsMap = new Map<string, typeof todosItems>();
      todosItems.forEach(item => {
        const codigo = item.licitacion_codigo || item.licitacion_id;
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

      // 5. Actualizar compras ágiles y licitaciones con resultados (optimizado con batch)
      const updatesComprasAgiles: Array<{ codigo: string; match_encontrado: boolean; match_score: number }> = [];
      const updatesLicitaciones: Array<{ id_licitacion: string; procesada: boolean; match_encontrado: boolean; match_score: number }> = [];
      
      // Crear Set de códigos de compras_agiles para búsqueda O(1)
      const codigosCA = new Set((comprasAgiles || []).map(ca => ca.codigo));
      
      // Separar updates por tabla
      for (const result of response.results) {
        const matchEncontrado = result.match_score >= 40;
        
        // Verificar si existe en compras_agiles usando Set (O(1))
        if (codigosCA.has(result.licitacion_id)) {
          updatesComprasAgiles.push({
            codigo: result.licitacion_id,
            match_encontrado: matchEncontrado,
            match_score: result.match_score
          });
        } else {
          updatesLicitaciones.push({
            id_licitacion: result.licitacion_id,
            procesada: true,
            match_encontrado: matchEncontrado,
            match_score: result.match_score
          });
        }
      }
      
      // Batch updates para compras_agiles
      if (updatesComprasAgiles.length > 0) {
        // Supabase no soporta batch updates nativamente, pero podemos hacer updates en paralelo
        await Promise.all(
          updatesComprasAgiles.map(update =>
            supabase
              .from('compras_agiles')
              .update({
                match_encontrado: update.match_encontrado,
                match_score: update.match_score
              })
              .eq('codigo', update.codigo)
          )
        );
      }
      
      // Batch updates para licitaciones (legacy)
      if (updatesLicitaciones.length > 0) {
        await Promise.all(
          updatesLicitaciones.map(update =>
            supabase
              .from('licitaciones')
              .update({
                procesada: update.procesada,
                match_encontrado: update.match_encontrado,
                match_score: update.match_score
              })
              .eq('id_licitacion', update.id_licitacion)
          )
        );
      }

      return response;
    },
    onSuccess: (data) => {
      // Invalidar solo las queries relevantes (optimizado)
      queryClient.invalidateQueries({ 
        queryKey: ['compras_agiles'],
        exact: false // Invalida todas las variantes
      });
      queryClient.invalidateQueries({ 
        queryKey: ['licitaciones'],
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['oportunidades'],
        exact: false
      });
      
      // Invalidar queries específicas solo si hay matches
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

  // Query para detectar compras ágiles no procesadas (optimizado)
  const { data: licitacionesNuevas } = useQuery({
    queryKey: ['licitaciones-sin-procesar'],
    queryFn: async () => {
      // Consultar compras_agiles sin match
      const { data: comprasAgiles, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo')
        .or('match_encontrado.eq.false,match_encontrado.is.null')
        .limit(1);

      if (caError) {
        console.warn('Error consultando compras_agiles:', caError);
        // Continuar con licitaciones legacy
      }
      
      // También consultar licitaciones legacy (en paralelo si es posible)
      const licitacionesPromise = supabase
        .from('licitaciones')
        .select('id_licitacion')
        .eq('procesada', false)
        .limit(1);

      const { data: licitaciones, error: licError } = await licitacionesPromise;

      if (licError) {
        console.warn('Error consultando licitaciones:', licError);
      }
      
      // Combinar resultados
      const todas = [
        ...(comprasAgiles || []).map(ca => ({ id_licitacion: ca.codigo })),
        ...(licitaciones || []),
      ];
      
      return todas;
    },
    refetchInterval: 30000, // Revisar cada 30 segundos
    staleTime: 15000, // Cache por 15 segundos
    gcTime: 60000, // Garbage collect después de 1 minuto
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

// Hook para obtener el resultado de matching de una licitación específica (optimizado)
export function useMatchingResult(licitacionId: string | null) {
  return useQuery({
    queryKey: ['matching-result', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return null;

      // Buscar primero en compras_agiles (más común)
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

      // Si no está en compras_agiles, buscar en licitaciones (legacy)
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
    staleTime: 30000, // Cache por 30 segundos
    gcTime: 120000, // Garbage collect después de 2 minutos
  });
}