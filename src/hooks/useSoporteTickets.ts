import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// =============================================================================
// Tickets de soporte (casos que Evaristo canaliza al equipo).
// - El cliente ve SOLO los suyos (RLS: user_id = auth.uid()).
// - El admin ve TODOS y puede cambiar el estado (RLS: is_admin o correo fundador).
// La tabla es nueva y no está en los tipos generados => casteamos a any.
// =============================================================================

export type EstadoTicket = 'abierto' | 'en_proceso' | 'resuelto';

export interface SoporteTicket {
  id: string;
  numero: number;
  cliente_id: string | null;
  user_id: string | null;
  email: string;
  nombre: string | null;
  empresa: string | null;
  telefono: string | null;
  canal: string;
  pantalla: string | null;
  asunto: string | null;
  mensaje: string | null;
  conversacion: { role: string; content: string }[] | null;
  estado: EstadoTicket;
  created_at: string;
  updated_at: string;
}

export const ESTADO_LABEL: Record<EstadoTicket, string> = {
  abierto: 'Abierto',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
};

// Clases de color por estado (badge). Usamos tonos suaves de la paleta.
export const ESTADO_BADGE: Record<EstadoTicket, string> = {
  abierto: 'bg-amber-100 text-amber-800 border-amber-200',
  en_proceso: 'bg-blue-100 text-blue-800 border-blue-200',
  resuelto: 'bg-green-100 text-green-800 border-green-200',
};

// Los tickets del cliente autenticado (sus propias consultas).
export function useMisTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mis-tickets', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SoporteTicket[]> => {
      const { data, error } = await (supabaseClient as any)
        .from('soporte_tickets')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SoporteTicket[];
    },
  });
}

// Todos los tickets (solo admin; RLS filtra). Opcionalmente por estado.
export function useTicketsAdmin(estado?: EstadoTicket | 'todos') {
  return useQuery({
    queryKey: ['tickets-admin', estado ?? 'todos'],
    queryFn: async (): Promise<SoporteTicket[]> => {
      let q = (supabaseClient as any)
        .from('soporte_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (estado && estado !== 'todos') q = q.eq('estado', estado);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SoporteTicket[];
    },
    refetchInterval: 60000,
  });
}

// Cambiar el estado de un ticket (admin).
export function useActualizarEstadoTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoTicket }) => {
      const { error } = await (supabaseClient as any)
        .from('soporte_tickets')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Al resolver, avisamos al cliente por correo (no bloquea el cambio si falla).
      if (estado === 'resuelto') {
        try {
          await supabaseClient.functions.invoke('notificar-ticket-resuelto', {
            body: { ticket_id: id },
          });
        } catch (e) {
          console.error('No se pudo avisar al cliente del ticket resuelto:', e);
        }
      }
      return { id, estado };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-admin'] });
      queryClient.invalidateQueries({ queryKey: ['mis-tickets'] });
      toast.success(
        res.estado === 'resuelto' ? 'Resuelto — le avisamos al cliente por correo' : 'Estado actualizado'
      );
    },
    onError: () => toast.error('No se pudo actualizar el estado'),
  });
}
