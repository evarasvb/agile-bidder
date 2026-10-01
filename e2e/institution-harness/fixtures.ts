// Offline fixtures for data hooks only. Components, URL resolution and CSS are real.
import type { InstitucionSeguida, InstitucionZoom } from '../../src/hooks/useInstitucionZoom';
import type { InstitutionNotice } from '../../src/lib/institutionFollowing';
const scenario = () => sessionStorage.getItem('scenario') || 'normal';
const follows: InstitucionSeguida[] = Array.from({ length: 12 }, (_, i) => ({ rut_institucion: `fixture-${i}`, nombre_institucion: `Institución de prueba ${i + 1}`, created_at: '2026-09-01T12:00:00Z' }));
const notices: (InstitutionNotice & { created_at: string })[] = [
  { id: 'claim-1', tipo: 'reclamo_institucion', licitacion_id: null, created_at: '2026-09-28T12:00:00Z', datos: { rut_institucion: 'fixture-0', evento_id: 'event-claim-1', titulo: 'Reclamo por no pago', detalle: 'Detalle exacto del reclamo recibido' } },
  { id: 'legacy-news', tipo: 'medio_institucion', licitacion_id: null, created_at: '2026-09-27T12:00:00Z', datos: { institucion: 'Institución de prueba 2', titulo: 'Noticia antigua de institución', detalle: 'Contenido conservado del aviso antiguo', url: 'https://example.invalid/noticia' } },
  { id: 'claim-2', tipo: 'reclamo_institucion', licitacion_id: null, created_at: '2026-09-28T12:00:00Z', datos: { rut_institucion: 'fixture-1', titulo: 'Segundo reclamo en otra institución', detalle: 'Detalle de institución dos' } },
];
function query<T>(data: T, error = false) { return { data, isLoading: false, isError: error, refetch: () => undefined }; }
export function useInstitucionesSeguidas() { return query(scenario() === 'empty' ? [] : follows, scenario() === 'error'); }
export function useInstitutionNotice(id: string | null) { return query(notices.find(n => n.id === id) || null, scenario() === 'notice-error'); }
export function useInstitucionZoom(rut: string | null) {
  if (!rut || !follows.some(f => f.rut_institucion === rut)) return query(null);
  const zoom: InstitucionZoom = {
    rut, encontrada: true, institucion: follows.find(f => f.rut_institucion === rut)!.nombre_institucion,
    conducta_pago: null, pago_promedio_dias: null, plazo_pago: null, pago_actualizado_el: null,
    reclamos_ficha: null, oc_total: null, oc_monto_total: null, reclamos_pago_12m: null,
    reclamos_proceso_12m: null, reclamos_pago_90d: null, reclamantes_pago: null, top_reclamante_pct: null,
    procesos_12m: null, pago_por_100_procesos: null, reclamos_desde: null, nivel: 'sin_dato',
    reclamos: [{ fecha: '2026-09-28', tipo: 1, reclamante: 'Reclamante de fixture', estado: 'Abierto', proceso_codigo: '100-1-LE26' }],
    noticias: [{ titulo: `Noticia reciente ${rut}`, url: 'https://example.invalid/reciente', medio: 'Medio de prueba', fecha: '2026-09-28' }],
    licitaciones: [{ codigo: '100-1-LE26', nombre: 'Licitación de fixture', estado: 'Abierta', fecha_cierre: '2026-10-30', fecha_publicacion: '2026-09-20' }],
    compras_agiles: [], rf: [], rf_disponible: false, funcionarios: [], causas: [], cobranza: [], direccion: null, comuna: null, region: null,
  };
  return query(zoom, scenario() === 'detail-error');
}
export function usePlan() { return { verInteligencia: scenario() !== 'basic' }; }
export const formatCompact = (value: number) => String(value);
// Risk has its own service; isolating it keeps the institution/navigation suite offline.
export function RiesgoOrganismoCard() { return null; }
export function useAvisos() { return query(scenario() === 'empty' ? [] : notices.map(n => ({ ...n, leida: false }))); }
export function useMarcarAvisosLeidos() { return { mutate: () => undefined, isPending: false }; }
export function useMarcarAvisoLeido() { return { mutate: (id: string) => sessionStorage.setItem('read-notice', id), isPending: false }; }
export function useDejarInstitucion() { return { mutate: (rut: string) => sessionStorage.setItem('unfollow', rut), isPending: false }; }
