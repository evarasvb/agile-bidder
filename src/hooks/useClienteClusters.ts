import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { normalizar } from './useClienteFiltros';
import { toast } from 'sonner';

// =============================================================================
// Clusters de búsqueda de oportunidades (por rubro/industria)
// -----------------------------------------------------------------------------
// Antes las palabras clave del cliente eran UNA bolsa plana
// (cliente_filtros_oportunidades.palabras_incluir), lo que mezclaba rubros muy
// distintos en un cliente que vende varias líneas (ej: oficina + aseo). Acá
// cada cluster = una industria (misma lista fija que el onboarding) con sus
// propias palabras, su propia ampliación IA, y un on/off propio — sin tocar
// la bolsa plana legacy, que sigue aplicando ADEMÁS de los clusters activos
// (ver palabrasActivasClusters + su uso en useClienteFiltros.ts).
// =============================================================================

export interface ClusterPalabras {
  id: string;
  cliente_id: string;
  industria: string;
  activo: boolean;
  palabras: string[];
  palabras_ia: string[];
  palabras_ia_descartadas: string[];
  created_at?: string;
  updated_at?: string;
}

async function resolverClienteId(userId: string): Promise<string | null> {
  const { data } = await supabaseClient
    .from('clientes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// Palabras de todos los clusters ACTIVOS (propias + ampliadas por IA que el
// cliente no apagó). Se usa ADEMÁS de palabras_incluir/_ia del modo plano, no
// en su reemplazo: activar clusters solo suma precisión, nunca quita matches
// que ya funcionaban.
export function palabrasActivasClusters(clusters: ClusterPalabras[] | undefined): string[] {
  const set = new Set<string>();
  for (const c of clusters || []) {
    if (!c.activo) continue;
    const descartadas = new Set((c.palabras_ia_descartadas || []).map(normalizar));
    for (const p of c.palabras || []) if (p) set.add(p);
    for (const p of c.palabras_ia || []) if (p && !descartadas.has(normalizar(p))) set.add(p);
  }
  return [...set];
}

export function useClienteClusters() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cliente-clusters', user?.id],
    queryFn: async (): Promise<ClusterPalabras[]> => {
      if (!user?.id) return [];
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) return [];

      const { data, error } = await supabaseClient
        .from('cliente_cluster_palabras')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('industria');

      if (error) {
        console.error('Error fetching cliente clusters:', error);
        throw error;
      }
      return (data as ClusterPalabras[]) || [];
    },
    enabled: !!user?.id,
  });
}

// Crea o actualiza un cluster (upsert por industria). Pasar solo los campos
// que cambian; el resto se conserva.
export function useGuardarCluster() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cambio: Partial<ClusterPalabras> & { industria: string }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');

      const { data, error } = await supabaseClient
        .from('cliente_cluster_palabras')
        .upsert(
          { cliente_id: clienteId, ...cambio, updated_at: new Date().toISOString() },
          { onConflict: 'cliente_id,industria' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as ClusterPalabras;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-clusters'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-filtradas'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
    },
    onError: (error) => {
      console.error('Error guardando cluster:', error);
      toast.error('No se pudo guardar el cluster');
    },
  });
}

export function useEliminarCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clusterId: string) => {
      const { error } = await supabaseClient
        .from('cliente_cluster_palabras')
        .delete()
        .eq('id', clusterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-clusters'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-filtradas'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
      toast.success('Cluster eliminado');
    },
    onError: (error) => {
      console.error('Error eliminando cluster:', error);
      toast.error('No se pudo eliminar el cluster');
    },
  });
}

// Pide a la IA que amplíe las palabras de UN cluster puntual (mismo edge
// function que el modo plano, con `industria` para que guarde en la tabla
// correcta — ver supabase/functions/expandir-conceptos).
export function useExpandirConceptosCluster() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ industria, palabras }: { industria: string; palabras: string[] }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');
      if (!palabras.length) return { palabras_ia: [] as string[] };

      const { data, error } = await supabaseClient.functions.invoke('expandir-conceptos', {
        body: { cliente_id: clienteId, palabras, industria },
      });
      if (error) throw error;
      return { palabras_ia: (data?.palabras_incluir_ia as string[]) || [] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-clusters'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
    },
    onError: (error) => {
      console.error('Error ampliando conceptos del cluster:', error);
    },
  });
}
