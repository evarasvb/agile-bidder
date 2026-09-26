// Hook para el panel de administración de Evaristo (Admin > Evaristo).
// "Revisar" y "Misión" llaman a evaristo_admin_resumen(), una RPC real (solo
// admins) que arma un snapshot del sistema: tickets abiertos, acciones de la
// extensión, actividad de los 3 Evaristos (chat/abogado/experto) y clientes.
// No ejecuta nada por sí sola: es la misma foto real que vería un admin
// mirando las tablas, pero en un mensaje legible.
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

interface EvaristoStatus {
  status: string;
  user_email: string | null;
  is_authorized: boolean;
  timestamp: string;
}

interface EvaristoResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

interface ResumenAdmin {
  ahora: string;
  tickets: { abiertos: number; en_proceso: number; ultimos: Array<{ numero: number; asunto: string; canal: string; cuando: string }> };
  acciones: {
    pendientes: number;
    fallidas_24h: number;
    hechas_24h: number;
    ultimas_fallidas: Array<{ tipo: string; codigo: string | null; error: string; cuando: string }>;
  };
  actividad_evaristo: { conversaciones_24h: number; mensajes_24h: number; mensajes_por_canal_24h: Record<string, number> };
  clientes: { total: number; nuevos_7d: number };
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

function isAuthorized(email: string | null | undefined): boolean {
  return email?.toLowerCase() === 'evaras@firmavb.cl';
}

function formatearResumen(r: ResumenAdmin, etiqueta: string): string {
  const canales = Object.entries(r.actividad_evaristo.mensajes_por_canal_24h)
    .map(([canal, n]) => `${canal}: ${n}`)
    .join(', ') || 'sin actividad';
  const lineas = [
    `📋 ${etiqueta} — ${new Date(r.ahora).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
    '',
    `🎫 Tickets de soporte: ${r.tickets.abiertos} abiertos, ${r.tickets.en_proceso} en proceso`,
    r.tickets.ultimos.length
      ? '   Últimos: ' + r.tickets.ultimos.map((t) => `#${t.numero} ${t.asunto} (${t.canal})`).join(' · ')
      : '   Sin tickets pendientes.',
    '',
    `🤖 Acciones de la extensión (últimas 24 h): ${r.acciones.hechas_24h} hechas, ${r.acciones.fallidas_24h} fallidas, ${r.acciones.pendientes} en cola`,
    r.acciones.ultimas_fallidas.length
      ? '   Fallas recientes: ' + r.acciones.ultimas_fallidas.map((a) => `${a.tipo}${a.codigo ? ' ' + a.codigo : ''} (${a.error || 'sin detalle'})`).join(' · ')
      : '   Sin fallas registradas.',
    '',
    `💬 Don Evaristo (últimas 24 h): ${r.actividad_evaristo.conversaciones_24h} conversaciones, ${r.actividad_evaristo.mensajes_24h} mensajes — por módulo: ${canales}`,
    '',
    `👥 Clientes: ${r.clientes.total} en total, ${r.clientes.nuevos_7d} nuevos esta semana`,
  ];
  return lineas.join('\n');
}

export function useEvaristoStatus() {
  return useQuery({
    queryKey: ['evaristo', 'status'],
    queryFn: async (): Promise<EvaristoStatus> => {
      const session = await getSession();
      const userEmail = session?.user?.email || null;
      return {
        status: session ? 'online' : 'offline',
        user_email: userEmail,
        is_authorized: isAuthorized(userEmail),
        timestamp: new Date().toISOString(),
      };
    },
    refetchInterval: 30000,
  });
}

async function pedirResumenAdmin(etiqueta: string): Promise<EvaristoResponse> {
  const session = await getSession();
  if (!session) throw new Error('No session - Inicia sesión para acceder a Evaristo');
  if (!isAuthorized(session.user.email)) throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');

  const { data, error } = await supabaseClient.rpc('evaristo_admin_resumen');
  if (error) throw new Error(error.message);

  return {
    success: true,
    message: formatearResumen(data as unknown as ResumenAdmin, etiqueta),
    timestamp: new Date().toISOString(),
  };
}

export function useEvaristoRevisar() {
  return useMutation({
    mutationFn: () => pedirResumenAdmin('Revisión del proyecto'),
  });
}

export function useEvaristoMision() {
  return useMutation({
    mutationFn: async ({ mision_file }: { mision_file: string; api_keys?: { gemini?: string; deepseek?: string } }): Promise<EvaristoResponse> => {
      // No hay un ejecutor de "misiones" real detrás de esto todavía: por ahora
      // una misión es el mismo chequeo real del sistema, etiquetado con el
      // archivo pedido (para no inventar tareas ni optimizaciones que no ocurrieron).
      return pedirResumenAdmin(`Misión "${mision_file}"`);
    },
  });
}
