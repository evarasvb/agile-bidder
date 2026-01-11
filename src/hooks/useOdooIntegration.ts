import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Oferta, ProductoOfertado } from './useOfertas';

interface LicitacionData {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  link_oficial: string | null;
  match_score: number | null;
}

interface OfertaData {
  id: string;
  valor_total_oferta: number;
  margen_total: number;
  productos_ofertados: ProductoOfertado[];
}

interface SendToOdooRequest {
  action: 'create_opportunity' | 'update_opportunity' | 'sync_products';
  licitacion: LicitacionData;
  oferta?: OfertaData;
  odoo_opportunity_id?: number;
}

interface SendToOdooResponse {
  success: boolean;
  odoo_opportunity_id?: number;
  is_new?: boolean;
  message?: string;
  error?: string;
}

/**
 * Hook to send a licitacion/oferta to Odoo CRM
 */
export function useSendToOdoo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SendToOdooRequest): Promise<SendToOdooResponse> => {
      console.log('Sending to Odoo:', request);
      
      const { data, error } = await supabase.functions.invoke('send-licitacion-to-odoo', {
        body: request,
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Error al conectar con Odoo');
      }

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido al enviar a Odoo');
      }

      return data as SendToOdooResponse;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Enviado a Odoo exitosamente');
      queryClient.invalidateQueries({ queryKey: ['odoo-opportunities'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al enviar a Odoo: ${error.message}`);
    },
  });
}

/**
 * Send a licitacion with its oferta to Odoo
 */
export function useSendLicitacionToOdoo() {
  const sendToOdoo = useSendToOdoo();

  return useMutation({
    mutationFn: async ({
      licitacion,
      oferta,
    }: {
      licitacion: LicitacionData;
      oferta?: Oferta;
    }) => {
      const ofertaData: OfertaData | undefined = oferta ? {
        id: oferta.id,
        valor_total_oferta: oferta.valor_total_oferta,
        margen_total: oferta.margen_total,
        productos_ofertados: oferta.productos_ofertados,
      } : undefined;

      return sendToOdoo.mutateAsync({
        action: 'create_opportunity',
        licitacion,
        oferta: ofertaData,
      });
    },
  });
}

/**
 * Update an existing opportunity in Odoo
 */
export function useUpdateOdooOpportunity() {
  const sendToOdoo = useSendToOdoo();

  return useMutation({
    mutationFn: async ({
      odooOpportunityId,
      licitacion,
      oferta,
    }: {
      odooOpportunityId: number;
      licitacion: LicitacionData;
      oferta?: Oferta;
    }) => {
      const ofertaData: OfertaData | undefined = oferta ? {
        id: oferta.id,
        valor_total_oferta: oferta.valor_total_oferta,
        margen_total: oferta.margen_total,
        productos_ofertados: oferta.productos_ofertados,
      } : undefined;

      return sendToOdoo.mutateAsync({
        action: 'update_opportunity',
        licitacion,
        oferta: ofertaData,
        odoo_opportunity_id: odooOpportunityId,
      });
    },
  });
}

/**
 * Sync products to an Odoo opportunity quotation
 */
export function useSyncProductsToOdoo() {
  const sendToOdoo = useSendToOdoo();

  return useMutation({
    mutationFn: async ({
      odooOpportunityId,
      licitacion,
      oferta,
    }: {
      odooOpportunityId: number;
      licitacion: LicitacionData;
      oferta: Oferta;
    }) => {
      return sendToOdoo.mutateAsync({
        action: 'sync_products',
        licitacion,
        oferta: {
          id: oferta.id,
          valor_total_oferta: oferta.valor_total_oferta,
          margen_total: oferta.margen_total,
          productos_ofertados: oferta.productos_ofertados,
        },
        odoo_opportunity_id: odooOpportunityId,
      });
    },
  });
}

/**
 * Fetch Odoo opportunities from the proxy
 */
export function useOdooOpportunities() {
  return useQuery({
    queryKey: ['odoo-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('odoo-proxy', {
        body: { action: 'fetch_opportunities' },
      });

      if (error) {
        console.error('Error fetching Odoo opportunities:', error);
        return [];
      }

      return data?.opportunities || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Check if Odoo is configured
 */
export function useOdooStatus() {
  return useQuery({
    queryKey: ['odoo-status'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('odoo-proxy', {
          body: { action: 'fetch_opportunities' },
        });

        if (error) {
          return { configured: false, error: error.message };
        }

        // If we got a message about not being configured, return that
        if (data?.message?.includes('not configured')) {
          return { configured: false, message: data.message };
        }

        return { 
          configured: true, 
          opportunityCount: data?.opportunities?.length || 0 
        };
      } catch (err) {
        return { 
          configured: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        };
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
