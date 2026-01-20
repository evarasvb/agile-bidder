import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for notification system
export type NotificationType = 
  | 'nuevo_match' 
  | 'cierre_proximo' 
  | 'cambio_licitacion' 
  | 'nueva_licitacion' 
  | 'oferta_enviada' 
  | 'adjudicacion' 
  | 'recordatorio' 
  | 'resumen_diario';

export interface NotificationData {
  licitacion_id?: string;
  licitacion_codigo?: string;
  licitacion_titulo?: string;
  match_score?: number;
  organismo?: string;
  presupuesto?: number;
  fecha_cierre?: string;
  horas_restantes?: number;
  resumen?: string;
  // Oferta enviada
  oferta_id?: string;
  monto_ofertado?: number;
  productos_count?: number;
  // Adjudicación
  resultado?: 'ganada' | 'perdida' | 'desierta';
  monto_adjudicado?: number;
  proveedor_ganador?: string;
  // Recordatorio
  dias_restantes?: number;
  accion_pendiente?: string;
  productos_match?: Array<{ nombre: string; score: number }>;
}

export interface SendNotificationParams {
  to?: string;
  clienteId?: string;
  template: NotificationType;
  data: NotificationData;
}

interface EventoNotificacion {
  tipo: 'nuevo_match' | 'cierre_proximo' | 'cambio_licitacion';
  licitacion_id: string;
  datos: NotificationData;
}

interface NotificacionPreferencias {
  email_instantaneo: boolean;
  resumen_diario: boolean;
  resumen_semanal: boolean;
  alerta_nuevos_matches: boolean;
  alerta_cierre_proximo: boolean;
  alerta_cambios_guardadas: boolean;
  horas_antes_cierre: number;
  score_minimo_alerta: number;
  presupuesto_minimo: number | null;
  webhook_url: string | null;
}

// Hook para obtener preferencias de notificación del cliente
export function useNotificacionPreferencias(clienteId: string | null) {
  return useQuery({
    queryKey: ['notificacion-preferencias', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      
      const { data, error } = await supabase
        .from('cliente_notificaciones')
        .select('*')
        .eq('cliente_id', clienteId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clienteId,
  });
}

// Hook para actualizar preferencias
export function useActualizarNotificacionPreferencias() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clienteId, preferencias }: { 
      clienteId: string; 
      preferencias: Partial<NotificacionPreferencias> 
    }) => {
      // Try to update first
      const { data: existing } = await supabase
        .from('cliente_notificaciones')
        .select('id')
        .eq('cliente_id', clienteId)
        .single();
      
      if (existing) {
        const { error } = await supabase
          .from('cliente_notificaciones')
          .update(preferencias)
          .eq('cliente_id', clienteId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cliente_notificaciones')
          .insert({ cliente_id: clienteId, ...preferencias });
        if (error) throw error;
      }
    },
    onSuccess: (_, { clienteId }) => {
      queryClient.invalidateQueries({ queryKey: ['notificacion-preferencias', clienteId] });
      toast.success('Preferencias actualizadas');
    },
    onError: (error) => {
      console.error('Error updating preferences:', error);
      toast.error('Error al actualizar preferencias');
    }
  });
}

// Hook para enviar notificación (legacy)
export function useEnviarNotificacion() {
  return useMutation({
    mutationFn: async ({ clienteId, evento }: { 
      clienteId: string; 
      evento: EventoNotificacion 
    }) => {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          cliente_id: clienteId,
          tipo: evento.tipo,
          data: {
            licitacion_id: evento.licitacion_id,
            ...evento.datos
          }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error('Error sending notification:', error);
    }
  });
}

/**
 * Simplified hook to send notifications from any component
 * 
 * Usage:
 * ```tsx
 * const { sendNotification, isLoading } = useSendNotification();
 * 
 * await sendNotification({
 *   to: "cliente@empresa.cl", // or use clienteId
 *   template: "oferta_enviada",
 *   data: {
 *     licitacion_titulo: "Compra de equipos",
 *     monto_ofertado: 5000000,
 *     productos_count: 5
 *   }
 * });
 * ```
 */
export function useSendNotification() {
  const mutation = useMutation({
    mutationFn: async (params: SendNotificationParams) => {
      const { to, clienteId, template, data } = params;
      
      const { data: result, error } = await supabase.functions.invoke('send-notification', {
        body: {
          to,
          cliente_id: clienteId,
          tipo: template,
          data
        }
      });
      
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (result?.success) {
        console.log('Notification sent successfully:', result.messageId);
      }
    },
    onError: (error) => {
      console.error('Error sending notification:', error);
      toast.error('Error al enviar notificación');
    }
  });

  return {
    sendNotification: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

// Hook para detectar y procesar eventos de notificación
export function useNotificaciones(clienteId: string | null) {
  const { mutateAsync: enviarNotificacion } = useEnviarNotificacion();
  const { data: preferencias } = useNotificacionPreferencias(clienteId);
  
  // Detectar licitaciones con match alto que no han sido notificadas
  const detectarNuevosMatches = async (): Promise<EventoNotificacion[]> => {
    if (!clienteId) return [];
    
    const scoreMinimo = preferencias?.score_minimo_alerta || 70;
    
    // Get licitaciones with high match that haven't been notified
    const { data: licitaciones, error } = await supabase
      .from('licitaciones')
      .select('id_licitacion, titulo, organismo, presupuesto, fecha_cierre, match_score')
      .eq('match_encontrado', true)
      .gte('match_score', scoreMinimo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error || !licitaciones) return [];
    
    // Check which ones haven't been notified
    const { data: notificados } = await supabase
      .from('notificaciones_log')
      .select('licitacion_id')
      .eq('cliente_id', clienteId)
      .eq('tipo', 'nuevo_match')
      .in('licitacion_id', licitaciones.map(l => l.id_licitacion));
    
    const notificadosIds = new Set(notificados?.map(n => n.licitacion_id) || []);
    
    return licitaciones
      .filter(l => !notificadosIds.has(l.id_licitacion))
      .map(l => ({
        tipo: 'nuevo_match' as const,
        licitacion_id: l.id_licitacion,
        datos: {
          licitacion_titulo: l.titulo,
          match_score: l.match_score || 0,
          organismo: l.organismo,
          presupuesto: l.presupuesto || 0,
          fecha_cierre: l.fecha_cierre || undefined
        }
      }));
  };
  
  // Detectar licitaciones que cierran pronto
  const detectarCierreProximo = async (): Promise<EventoNotificacion[]> => {
    if (!clienteId) return [];
    
    const horasAntes = preferencias?.horas_antes_cierre || 48;
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() + horasAntes);
    
    const { data: licitaciones, error } = await supabase
      .from('licitaciones')
      .select('id_licitacion, titulo, organismo, presupuesto, fecha_cierre, match_score')
      .eq('match_encontrado', true)
      .lte('fecha_cierre', fechaLimite.toISOString())
      .gte('fecha_cierre', new Date().toISOString())
      .order('fecha_cierre', { ascending: true });
    
    if (error || !licitaciones) return [];
    
    // Check which ones haven't been notified for cierre_proximo
    const { data: notificados } = await supabase
      .from('notificaciones_log')
      .select('licitacion_id')
      .eq('cliente_id', clienteId)
      .eq('tipo', 'cierre_proximo')
      .in('licitacion_id', licitaciones.map(l => l.id_licitacion));
    
    const notificadosIds = new Set(notificados?.map(n => n.licitacion_id) || []);
    
    return licitaciones
      .filter(l => !notificadosIds.has(l.id_licitacion))
      .map(l => {
        const horasRestantes = Math.ceil(
          (new Date(l.fecha_cierre!).getTime() - Date.now()) / (1000 * 60 * 60)
        );
        return {
          tipo: 'cierre_proximo' as const,
          licitacion_id: l.id_licitacion,
          datos: {
            licitacion_titulo: l.titulo,
            match_score: l.match_score || 0,
            organismo: l.organismo,
            presupuesto: l.presupuesto || 0,
            fecha_cierre: l.fecha_cierre || undefined,
            horas_restantes: horasRestantes
          }
        };
      });
  };
  
  // Procesar todos los eventos pendientes
  const procesarEventos = async () => {
    if (!clienteId || !preferencias) return;
    
    const eventos: EventoNotificacion[] = [];
    
    // Detectar nuevos matches si está habilitado
    if (preferencias.alerta_nuevos_matches) {
      const matches = await detectarNuevosMatches();
      eventos.push(...matches);
    }
    
    // Detectar cierres próximos si está habilitado
    if (preferencias.alerta_cierre_proximo) {
      const cierres = await detectarCierreProximo();
      eventos.push(...cierres);
    }
    
    console.log(`Detectados ${eventos.length} eventos de notificación`);
    
    // Enviar notificaciones
    for (const evento of eventos) {
      try {
        await enviarNotificacion({ clienteId, evento });
      } catch (error) {
        console.error('Error enviando notificación:', error);
      }
    }
    
    return eventos.length;
  };
  
  return {
    procesarEventos,
    preferencias,
    enviarNotificacion: (evento: EventoNotificacion) => 
      clienteId ? enviarNotificacion({ clienteId, evento }) : Promise.resolve(null)
  };
}

// Hook para historial de notificaciones
export function useHistorialNotificaciones(clienteId: string | null) {
  return useQuery({
    queryKey: ['notificaciones-historial', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('notificaciones_log')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });
}
