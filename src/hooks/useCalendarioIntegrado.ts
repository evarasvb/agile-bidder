import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { addDays, differenceInDays, parseISO } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────
export type TipoEventoCalendario = 'cierre' | 'adjudicacion' | 'tarea' | 'recordatorio' | 'otro';
export type RepetirEvento = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarioEvent {
  id: string;
  title: string;
  start: string;       // ISO date
  end?: string | null;  // ISO date
  allDay: boolean;
  type: 'deadline_red' | 'deadline_yellow' | 'pipeline' | 'won' | 'team' | 'custom';
  sourceType: 'licitacion' | 'compra_agil' | 'pipeline' | 'custom';
  sourceId?: string;
  tipoBadge: string;
  monto?: number | null;
  institucion?: string | null;
  asignado?: string | null;
  descripcion?: string | null;
  color: string;
  textColor: string;
  borderColor: string;
}

export interface EventoCalendarioRow {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoEventoCalendario;
  fecha_inicio: string;
  fecha_fin: string | null;
  todo_el_dia: boolean;
  oportunidad_id: string | null;
  oportunidad_tipo: string | null;
  asignado_a: string | null;
  repetir: RepetirEvento;
  recordatorio_minutos: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  titulo: string;
  descripcion?: string;
  tipo: TipoEventoCalendario;
  fecha_inicio: string;
  fecha_fin?: string;
  todo_el_dia: boolean;
  oportunidad_id?: string;
  oportunidad_tipo?: string;
  asignado_a?: string;
  repetir: RepetirEvento;
  recordatorio_minutos?: number;
  color?: string;
}

// ── Color mapping ──────────────────────────────────────────────────
function getEventColors(type: CalendarioEvent['type']): { color: string; textColor: string; borderColor: string } {
  switch (type) {
    case 'deadline_red':
      return { color: '#ef4444', textColor: '#ffffff', borderColor: '#dc2626' };
    case 'deadline_yellow':
      return { color: '#f59e0b', textColor: '#ffffff', borderColor: '#d97706' };
    case 'pipeline':
      return { color: '#3b82f6', textColor: '#ffffff', borderColor: '#2563eb' };
    case 'won':
      return { color: '#22c55e', textColor: '#ffffff', borderColor: '#16a34a' };
    case 'team':
      return { color: '#a855f7', textColor: '#ffffff', borderColor: '#9333ea' };
    case 'custom':
      return { color: '#6b7280', textColor: '#ffffff', borderColor: '#4b5563' };
  }
}

function classifyDeadline(fechaCierre: string): 'deadline_red' | 'deadline_yellow' | 'pipeline' {
  const days = differenceInDays(parseISO(fechaCierre), new Date());
  if (days <= 3) return 'deadline_red';
  if (days <= 7) return 'deadline_yellow';
  return 'pipeline';
}

// ── Hook ───────────────────────────────────────────────────────────
const QUERY_KEY = 'calendario-integrado';

export function useCalendarioIntegrado() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all event sources and merge
  const eventsQuery = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async (): Promise<CalendarioEvent[]> => {
      if (!user?.id) return [];

      const events: CalendarioEvent[] = [];

      // 1. Licitaciones deadlines
      const { data: licitaciones } = await supabase
        .from('licitaciones_bi')
        .select('id, codigo, nombre, fecha_cierre, institucion_nombre, presupuesto_estimado, estado')
        .not('fecha_cierre', 'is', null);

      if (licitaciones) {
        for (const l of licitaciones) {
          if (!l.fecha_cierre) continue;
          const type = classifyDeadline(l.fecha_cierre);
          const colors = getEventColors(type);
          events.push({
            id: `lic-${l.id}`,
            title: `${l.codigo} - ${l.nombre}`,
            start: l.fecha_cierre,
            end: null,
            allDay: true,
            type,
            sourceType: 'licitacion',
            sourceId: l.id,
            tipoBadge: 'Cierre Licitación',
            monto: l.presupuesto_estimado,
            institucion: l.institucion_nombre,
            descripcion: l.nombre,
            asignado: null,
            ...colors,
          });
        }
      }

      // 2. Compras Ágiles deadlines
      const { data: compras } = await supabase
        .from('compras_agiles')
        .select('id, codigo, nombre, fecha_cierre, organismo, monto')
        .not('fecha_cierre', 'is', null);

      if (compras) {
        for (const c of compras) {
          if (!c.fecha_cierre) continue;
          const type = classifyDeadline(c.fecha_cierre);
          const colors = getEventColors(type);
          events.push({
            id: `ca-${c.id}`,
            title: `${c.codigo} - ${c.nombre}`,
            start: c.fecha_cierre,
            end: null,
            allDay: true,
            type,
            sourceType: 'compra_agil',
            sourceId: c.id,
            tipoBadge: 'Cierre Compra Ágil',
            monto: c.monto,
            institucion: c.organismo,
            descripcion: c.nombre,
            asignado: null,
            ...colors,
          });
        }
      }

      // 3. Pipeline milestones
      const { data: pipelineItems } = await supabase
        .from('pipeline')
        .select('id, titulo, etapa, fecha_cierre, institucion, monto_estimado, asignado_a, oportunidad_id, oportunidad_tipo')
        .eq('user_id', user.id);

      if (pipelineItems) {
        for (const p of pipelineItems) {
          if (!p.fecha_cierre) continue;
          const isWon = p.etapa === 'adjudicada' || p.etapa === 'oc_emitida' || p.etapa === 'pagada';
          const type = isWon ? 'won' as const : 'pipeline' as const;
          const colors = getEventColors(type);
          const etapaLabel = {
            descubierta: 'Descubierta', seguimiento: 'Seguimiento', preparacion: 'Preparación',
            postulada: 'Postulada', evaluacion: 'Evaluación', adjudicada: 'Adjudicada',
            oc_emitida: 'OC Emitida', pagada: 'Pagada',
          }[p.etapa] || p.etapa;
          events.push({
            id: `pipe-${p.id}`,
            title: p.titulo,
            start: p.fecha_cierre,
            end: null,
            allDay: true,
            type,
            sourceType: 'pipeline',
            sourceId: p.oportunidad_id,
            tipoBadge: `Pipeline: ${etapaLabel}`,
            monto: p.monto_estimado,
            institucion: p.institucion,
            descripcion: null,
            asignado: p.asignado_a,
            ...colors,
          });
        }
      }

      // 4. Custom events (eventos_calendario)
      try {
        const { data: customEvents } = await supabase
          .from('eventos_calendario' as any)
          .select('*')
          .eq('user_id', user.id);

        if (customEvents) {
          for (const e of customEvents as unknown as EventoCalendarioRow[]) {
            const tipoBadgeMap: Record<TipoEventoCalendario, string> = {
              cierre: 'Cierre', adjudicacion: 'Adjudicación', tarea: 'Tarea',
              recordatorio: 'Recordatorio', otro: 'Otro',
            };
            const type = e.tipo === 'tarea' ? 'team' as const : 'custom' as const;
            const colors = e.color
              ? { color: e.color, textColor: '#ffffff', borderColor: e.color }
              : getEventColors(type);
            events.push({
              id: `evt-${e.id}`,
              title: e.titulo,
              start: e.fecha_inicio,
              end: e.fecha_fin,
              allDay: e.todo_el_dia,
              type,
              sourceType: 'custom',
              sourceId: e.oportunidad_id || undefined,
              tipoBadge: tipoBadgeMap[e.tipo],
              monto: null,
              institucion: null,
              descripcion: e.descripcion,
              asignado: e.asignado_a,
              ...colors,
            });
          }
        }
      } catch {
        // Table may not exist yet – ignore
      }

      return events;
    },
    enabled: !!user?.id,
  });

  // Create custom event mutation
  const createEvent = useMutation({
    mutationFn: async (input: CreateEventInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('eventos_calendario' as any)
        .insert({
          user_id: user.id,
          titulo: input.titulo,
          descripcion: input.descripcion || null,
          tipo: input.tipo,
          fecha_inicio: input.fecha_inicio,
          fecha_fin: input.fecha_fin || null,
          todo_el_dia: input.todo_el_dia,
          oportunidad_id: input.oportunidad_id || null,
          oportunidad_tipo: input.oportunidad_tipo || null,
          asignado_a: input.asignado_a || null,
          repetir: input.repetir,
          recordatorio_minutos: input.recordatorio_minutos || null,
          color: input.color || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });

  // Delete custom event mutation
  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('eventos_calendario' as any)
        .delete()
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    createEvent,
    deleteEvent,
  };
}
