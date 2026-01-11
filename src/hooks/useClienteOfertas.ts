import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getClienteId } from '@/hooks/useCliente';
import { useToast } from '@/hooks/use-toast';

export interface ProductoOfertado {
  inventory_id: string;
  sku: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  precio_total: number;
  margen_aplicado: number;
}

export interface ClienteOferta {
  id: string;
  cliente_id: string;
  licitacion_id: string;
  estado: 'borrador' | 'revision' | 'aprobada' | 'enviada' | 'rechazada';
  match_score: number | null;
  productos_ofertados: ProductoOfertado[];
  valor_total: number | null;
  margen_total: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  licitacion?: {
    id_licitacion: string;
    titulo: string;
    organismo: string;
    presupuesto: number | null;
    fecha_cierre: string | null;
    estado: string | null;
    created_at: string;
  };
}

function parseOferta(data: unknown): ClienteOferta {
  const raw = data as Record<string, unknown>;
  return {
    ...raw,
    productos_ofertados: (raw.productos_ofertados || []) as ProductoOfertado[],
  } as ClienteOferta;
}

// Hook para ofertas del cliente actual
export function useClienteOfertas() {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-ofertas', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('cliente_ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre, estado, created_at)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(parseOferta);
    },
    enabled: !!clienteId,
  });
}

// Hook para ofertas con match >= 80%
export function useClienteOfertasConMatch(minScore: number = 80) {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-ofertas-match', clienteId, minScore],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('cliente_ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre, estado, created_at)
        `)
        .eq('cliente_id', clienteId)
        .gte('match_score', minScore)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Ordenar por fecha de cierre más próxima
      const ofertas = (data || []).map(parseOferta);
      return ofertas.sort((a, b) => {
        const fechaA = a.licitacion?.fecha_cierre ? new Date(a.licitacion.fecha_cierre).getTime() : Infinity;
        const fechaB = b.licitacion?.fecha_cierre ? new Date(b.licitacion.fecha_cierre).getTime() : Infinity;
        return fechaA - fechaB;
      });
    },
    enabled: !!clienteId,
  });
}

// Hook para una oferta específica
export function useClienteOferta(id: string | null) {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-oferta', id],
    queryFn: async () => {
      if (!id || !clienteId) return null;

      const { data, error } = await supabase
        .from('cliente_ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre, estado, created_at)
        `)
        .eq('id', id)
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) throw error;
      return data ? parseOferta(data) : null;
    },
    enabled: !!id && !!clienteId,
  });
}

// Hook para actualizar estado de oferta
export function useActualizarEstadoOfertaCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clienteId = getClienteId();

  return useMutation({
    mutationFn: async ({
      ofertaId,
      estado,
      notas,
    }: {
      ofertaId: string;
      estado: ClienteOferta['estado'];
      notas?: string;
    }) => {
      const updateData: Record<string, unknown> = { estado };
      if (notas) {
        updateData.notas = notas;
      }

      const { error } = await supabase
        .from('cliente_ofertas')
        .update(updateData)
        .eq('id', ofertaId)
        .eq('cliente_id', clienteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-ofertas'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-oferta'] });
      toast({
        title: 'Estado actualizado',
        description: 'La oferta ha sido actualizada correctamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook para actualizar productos de oferta
export function useActualizarProductosOfertaCliente() {
  const queryClient = useQueryClient();
  const clienteId = getClienteId();

  return useMutation({
    mutationFn: async ({
      ofertaId,
      productos,
    }: {
      ofertaId: string;
      productos: ProductoOfertado[];
    }) => {
      const valorTotal = productos.reduce((sum, p) => sum + p.precio_total, 0);
      const costoTotal = productos.reduce(
        (sum, p) => sum + (p.precio_unitario / (1 + p.margen_aplicado / 100)) * p.cantidad,
        0
      );
      const margenTotal = costoTotal > 0
        ? Math.round(((valorTotal - costoTotal) / costoTotal) * 100)
        : 0;

      const { error } = await supabase
        .from('cliente_ofertas')
        .update({
          productos_ofertados: JSON.parse(JSON.stringify(productos)),
          valor_total: valorTotal,
          margen_total: margenTotal,
        })
        .eq('id', ofertaId)
        .eq('cliente_id', clienteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-ofertas'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-oferta'] });
    },
  });
}

// Hook para estadísticas de ofertas del cliente
export function useClienteOfertasStats() {
  const clienteId = getClienteId();

  return useQuery({
    queryKey: ['cliente-ofertas-stats', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('cliente_ofertas')
        .select('*')
        .eq('cliente_id', clienteId);

      if (error) throw error;

      const ofertas = (data || []).map(parseOferta);

      return {
        total: ofertas.length,
        borradores: ofertas.filter((o) => o.estado === 'borrador').length,
        revision: ofertas.filter((o) => o.estado === 'revision').length,
        aprobadas: ofertas.filter((o) => o.estado === 'aprobada').length,
        enviadas: ofertas.filter((o) => o.estado === 'enviada').length,
        valorTotal: ofertas.reduce((sum, o) => sum + (o.valor_total || 0), 0),
        promedioMatch: ofertas.length > 0
          ? Math.round(ofertas.reduce((sum, o) => sum + (o.match_score || 0), 0) / ofertas.length)
          : 0,
      };
    },
    enabled: !!clienteId,
  });
}
