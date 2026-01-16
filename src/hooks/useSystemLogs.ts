import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LogTipo = 'match' | 'oferta_generada' | 'oferta_enviada' | 'scraping' | 'error' | 'info';
export type LogSeveridad = 'info' | 'warning' | 'error' | 'success';

export interface SystemLog {
  id: string;
  tipo: LogTipo;
  severidad: LogSeveridad;
  mensaje: string;
  licitacion_id: string | null;
  oferta_id: string | null;
  detalles: Record<string, any>;
  created_at: string;
}

export interface LogInput {
  tipo: LogTipo;
  severidad: LogSeveridad;
  mensaje: string;
  licitacion_id?: string;
  oferta_id?: string;
  detalles?: Record<string, any>;
}

export function useSystemLogs(limit = 100, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['system_logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as SystemLog[];
    },
    refetchInterval: options?.refetchInterval ?? 10000, // 10 segundos por defecto
    refetchIntervalInBackground: true, // Continuar polling incluso si la pestaña no está activa
  });
}

export function useSystemLogsByType(tipo: LogTipo, limit = 50) {
  return useQuery({
    queryKey: ['system_logs', tipo, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as SystemLog[];
    },
  });
}

export function useSystemLogsBySeverity(severidad: LogSeveridad, limit = 50) {
  return useQuery({
    queryKey: ['system_logs', 'severity', severidad, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .eq('severidad', severidad)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as SystemLog[];
    },
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (log: LogInput) => {
      const { data, error } = await supabase
        .from('system_logs')
        .insert({
          tipo: log.tipo,
          severidad: log.severidad,
          mensaje: log.mensaje,
          licitacion_id: log.licitacion_id || null,
          oferta_id: log.oferta_id || null,
          detalles: log.detalles || {}
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as SystemLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_logs'] });
    },
  });
}

/**
 * Hook para logging consistente en la aplicación
 */
export function useLogger() {
  const createLog = useCreateLog();
  
  const log = async (
    tipo: LogTipo,
    mensaje: string,
    options?: {
      severidad?: LogSeveridad;
      licitacion_id?: string;
      oferta_id?: string;
      detalles?: Record<string, any>;
    }
  ) => {
    try {
      await createLog.mutateAsync({
        tipo,
        severidad: options?.severidad || 'info',
        mensaje,
        licitacion_id: options?.licitacion_id,
        oferta_id: options?.oferta_id,
        detalles: options?.detalles
      });
    } catch (e) {
      console.error('Error logging:', e);
    }
  };
  
  return {
    info: (mensaje: string, detalles?: Record<string, any>) => 
      log('info', mensaje, { severidad: 'info', detalles }),
    
    success: (mensaje: string, detalles?: Record<string, any>) => 
      log('info', mensaje, { severidad: 'success', detalles }),
    
    warning: (mensaje: string, detalles?: Record<string, any>) => 
      log('info', mensaje, { severidad: 'warning', detalles }),
    
    error: (mensaje: string, detalles?: Record<string, any>) => 
      log('error', mensaje, { severidad: 'error', detalles }),
    
    match: (mensaje: string, licitacion_id: string, detalles?: Record<string, any>) => 
      log('match', mensaje, { severidad: 'success', licitacion_id, detalles }),
    
    ofertaGenerada: (mensaje: string, oferta_id: string, detalles?: Record<string, any>) => 
      log('oferta_generada', mensaje, { severidad: 'success', oferta_id, detalles }),
    
    ofertaEnviada: (mensaje: string, oferta_id: string, detalles?: Record<string, any>) => 
      log('oferta_enviada', mensaje, { severidad: 'success', oferta_id, detalles }),
    
    scraping: (mensaje: string, detalles?: Record<string, any>) => 
      log('scraping', mensaje, { severidad: 'info', detalles }),
  };
}

export function useLogStats() {
  return useQuery({
    queryKey: ['system_logs', 'stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: allLogs, error } = await supabase
        .from('system_logs')
        .select('tipo, severidad, created_at')
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      
      const logs = allLogs as Pick<SystemLog, 'tipo' | 'severidad' | 'created_at'>[];
      
      return {
        total: logs.length,
        porTipo: {
          match: logs.filter(l => l.tipo === 'match').length,
          oferta_generada: logs.filter(l => l.tipo === 'oferta_generada').length,
          oferta_enviada: logs.filter(l => l.tipo === 'oferta_enviada').length,
          scraping: logs.filter(l => l.tipo === 'scraping').length,
          error: logs.filter(l => l.tipo === 'error').length,
          info: logs.filter(l => l.tipo === 'info').length,
        },
        porSeveridad: {
          info: logs.filter(l => l.severidad === 'info').length,
          warning: logs.filter(l => l.severidad === 'warning').length,
          error: logs.filter(l => l.severidad === 'error').length,
          success: logs.filter(l => l.severidad === 'success').length,
        }
      };
    },
  });
}
