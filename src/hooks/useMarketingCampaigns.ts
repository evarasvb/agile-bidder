import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requestCampaign } from '@/services/campaignResult';

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
  // Cluster de clientes al que le llega esta campaña — no todas son para
  // todos. null/undefined = ese filtro no aplica (llega a todos en ese eje).
  audiencia_fuente?: string | null;
  audiencia_rubro?: string | null;
  audiencia_categoria?: string | null;
  audiencia_suscripcion?: string | null;
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
  estado: 'draft' | 'ejecutando' | 'pendiente' | 'programado' | 'ejecutado' | 'enviado' | 'fallido';
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

export interface MarketingEjecucion {
  id: string;
  pieza_id: string;
  contacto_id?: string;
  email: string;
  estado: 'pendiente' | 'enviado' | 'entregado' | 'click' | 'fallo' | 'rebote';
  respuesta_codigo?: number;
  respuesta_mensaje?: string;
  abierto: boolean;
  clicks: number;
  fecha_envio?: string;
  creado_en: string;
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

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      // Borra en cascada piezas, métricas y ejecuciones de esta campaña (FK
      // on delete cascade en la base).
      const { error } = await supabase.from('marketing_campanas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      // Las ejecuciones de la campaña borrada también se van en cascada; si no
      // se invalida, la pestaña Ejecución sigue mostrando envíos ya eliminados.
      queryClient.invalidateQueries({ queryKey: ['marketing_ejecucion_recientes'] });
    },
  });

  return {
    campaigns: campaigns || [],
    isLoading,
    error,
    createCampaign: createCampaign.mutate,
    updateCampaign: updateCampaign.mutate,
    updateCampaignAsync: updateCampaign.mutateAsync,
    actualizandoCampaign: updateCampaign.isPending,
    deleteCampaign: deleteCampaign.mutateAsync,
    eliminandoCampaign: deleteCampaign.isPending,
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
    mutationFn: async ({ piezaId, contactosIds }: { piezaId: string; contactosIds: string[] }) => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error('La sesión no está disponible.');
      const publicApiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      return requestCampaign(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ejecutar`, data.session.access_token, publicApiKey, piezaId, contactosIds);
    },
    retry: false,
    onSuccess: (_data, { piezaId }) => {
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_metricas', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_ejecucion', piezaId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_ejecucion_recientes'] });
    },
  });

  const updatePieza = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingPieza> & { id: string }) => {
      const { data, error } = await supabase
        .from('marketing_piezas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MarketingPieza;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', campaignId] });
    },
  });

  const deletePieza = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_piezas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', campaignId] });
    },
  });

  return {
    piezas: piezas || [],
    isLoading,
    createPieza: createPieza.mutate,
    createPiezaAsync: createPieza.mutateAsync,
    creandoPieza: createPieza.isPending,
    ejecutarPieza: ejecutarPieza.mutateAsync,
    ejecutandoPieza: ejecutarPieza.isPending,
    updatePieza: updatePieza.mutate,
    updatePiezaAsync: updatePieza.mutateAsync,
    actualizandoPieza: updatePieza.isPending,
    deletePiezaAsync: deletePieza.mutateAsync,
    eliminandoPieza: deletePieza.isPending,
  };
}

// Lista de contactos/emails a los que se envió (o intentó enviar) una pieza —
// para email es real (marketing-ejecutar la llena); whatsapp/redes todavía se
// mandan a mano, así que para esas piezas no hay filas acá.
export function usePiezaEjecuciones(piezaId: string) {
  const { data: ejecuciones, isLoading, isError } = useQuery({
    queryKey: ['marketing_ejecucion', piezaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_ejecucion')
        .select('id, pieza_id, contacto_id, email, estado, respuesta_codigo, respuesta_mensaje, abierto, clicks, fecha_envio, creado_en')
        .eq('pieza_id', piezaId)
        .order('fecha_envio', { ascending: false });

      if (error) throw error;
      return (data || []) as MarketingEjecucion[];
    },
    enabled: !!piezaId,
  });

  return { ejecuciones: ejecuciones || [], isLoading, isError };
}

// Historial global de envíos (para la pestaña "Ejecución" del Centro de Control).
export function useMarketingEjecucionesRecientes(limit: number = 100) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['marketing_ejecucion_recientes', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_ejecucion')
        .select('id, email, estado, abierto, clicks, fecha_envio, creado_en, marketing_piezas(nombre, canal, campana_id, marketing_campanas(nombre))')
        .order('creado_en', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Array<MarketingEjecucion & {
        marketing_piezas: { nombre: string; canal: string; campana_id: string; marketing_campanas: { nombre: string } } | null;
      }>;
    },
  });

  return { ejecuciones: data || [], isLoading, isError };
}

// La tabla marketing_metricas no la llena ningún proceso (quedó como snapshot sin
// job que la actualice); las métricas se calculan en vivo desde marketing_ejecucion,
// que es donde marketing-ejecutar deja cada envío real.
export function useCampaignMetricas(campaignId: string, days: number = 30) {
  const { data: ejecuciones, isLoading } = useQuery({
    queryKey: ['marketing_ejecucion_campania', campaignId, days],
    queryFn: async () => {
      const { data: piezas, error: errPiezas } = await supabase
        .from('marketing_piezas')
        .select('id')
        .eq('campana_id', campaignId);
      if (errPiezas) throw errPiezas;
      const piezaIds = (piezas ?? []).map((p) => p.id);
      if (!piezaIds.length) return [];

      const { data, error } = await supabase
        .from('marketing_ejecucion')
        .select('estado, abierto, clicks, fecha_envio, creado_en')
        .in('pieza_id', piezaIds)
        .gte('creado_en', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return (data ?? []) as { estado: string; abierto: boolean; clicks: number; fecha_envio: string | null; creado_en: string }[];
    },
    enabled: !!campaignId,
  });

  const rows = ejecuciones ?? [];
  const enviados = rows.filter((r) => r.estado !== 'fallo' && r.estado !== 'rebote');
  const totalEnviados = enviados.length;
  const totalAbiertos = enviados.filter((r) => r.abierto).length;

  const porDia = new Map<string, MarketingMetricas>();
  for (const r of enviados) {
    const fecha = (r.fecha_envio ?? r.creado_en).slice(0, 10);
    const dia = porDia.get(fecha) ?? { campana_id: campaignId, fecha, total_enviados: 0, total_entregados: 0, total_abiertos: 0, total_clicks: 0, total_conversiones: 0 };
    dia.total_enviados += 1;
    if (r.abierto) dia.total_abiertos += 1;
    dia.total_clicks += r.clicks || 0;
    porDia.set(fecha, dia);
  }
  const metricas = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    metricas,
    isLoading,
    totalEnviados,
    // Las conversiones todavía no se rastrean por envío (no hay vínculo con
    // postulaciones u otra acción del contacto); queda en 0 hasta que exista esa fuente.
    totalConversiones: 0,
    promTasaApertura: totalEnviados > 0 ? totalAbiertos / totalEnviados : 0,
  };
}
