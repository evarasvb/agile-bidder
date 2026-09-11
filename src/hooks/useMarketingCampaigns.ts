import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketingCampaign {
  id: string;
  nombre: string;
  descripcion?: string;
  objetivo: string;
  estado: 'draft' | 'scheduled' | 'ejecutando' | 'completada' | 'cancelada';
  fecha_inicio?: string;
  fecha_fin?: string;
  presupuesto?: number;
  audiencia_estimada?: number;
  meta_conversiones?: number;
  meta_registros?: number;
  meta_asistencia?: number;
  creado_en: string;
  actualizado_en: string;
  notas?: string;
}

export interface MarketingPieza {
  id: string;
  campana_id: string;
  nombre: string;
  tipo: 'email' | 'whatsapp' | 'linkedin' | 'instagram' | 'tiktok' | 'web';
  canal: string;
  asunto?: string;
  contenido: string;
  url_tracking?: string;
  programado_para?: string;
  estado: 'draft' | 'programado' | 'ejecutado' | 'enviado' | 'fallido';
  cantidad_objetivo?: number;
  creado_en: string;
}

export interface MarketingMetricas {
  campana_id: string;
  fecha: string;
  total_enviados: number;
  total_entregados: number;
  total_abiertos: number;
  total_clicks: number;
  total_conversiones: number;
  tasa_entrega?: number;
  tasa_apertura?: number;
  tasa_click?: number;
  tasa_conversion?: number;
}

export function useCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['marketing_campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campanas')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      return (data || []) as MarketingCampaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Omit<MarketingCampaign, 'id' | 'creado_en' | 'actualizado_en'>) => {
      const { data, error } = await supabase
        .from('marketing_campanas')
        .insert([campaign])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('marketing_campanas')
        .update({ ...updates, actualizado_en: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
    },
  });

  return {
    campaigns: campaigns || [],
    isLoading,
    error,
    createCampaign: createCampaign.mutate,
    updateCampaign: updateCampaign.mutate,
  };
}

export function useCampaignPiezas(campaignId: string) {
  const { data: piezas, isLoading } = useQuery({
    queryKey: ['marketing_piezas', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_piezas')
        .select('*')
        .eq('campana_id', campaignId)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      return (data || []) as MarketingPieza[];
    },
    enabled: !!campaignId,
  });

  const queryClient = useQueryClient();

  const createPieza = useMutation({
    mutationFn: async (pieza: Omit<MarketingPieza, 'id' | 'creado_en'>) => {
      const { data, error } = await supabase
        .from('marketing_piezas')
        .insert([pieza])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', campaignId] });
    },
  });

  const ejecutarPieza = useMutation({
    mutationFn: async (piezaId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ejecutar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
          },
          body: JSON.stringify({ pieza_id: piezaId }),
        }
      );

      if (!response.ok) throw new Error('Error executing campaign');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_metricas', campaignId] });
    },
  });

  return {
    piezas: piezas || [],
    isLoading,
    createPieza: createPieza.mutate,
    ejecutarPieza: ejecutarPieza.mutate,
  };
}

export function useCampaignMetricas(campaignId: string, days: number = 7) {
  const { data: metricas, isLoading } = useQuery({
    queryKey: ['marketing_metricas', campaignId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_metricas')
        .select('*')
        .eq('campana_id', campaignId)
        .gte('fecha', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('fecha', { ascending: true });

      if (error) throw error;
      return (data || []) as MarketingMetricas[];
    },
    enabled: !!campaignId,
  });

  return {
    metricas: metricas || [],
    isLoading,
    totalEnviados: metricas?.reduce((sum, m) => sum + (m.total_enviados || 0), 0) || 0,
    totalConversiones: metricas?.reduce((sum, m) => sum + (m.total_conversiones || 0), 0) || 0,
    promTasaApertura: metricas && metricas.length > 0
      ? metricas.reduce((sum, m) => sum + (m.tasa_apertura || 0), 0) / metricas.length
      : 0,
  };
}
