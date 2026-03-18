export const PIPELINE_ETAPAS = [
  'descubierta',
  'seguimiento',
  'preparacion',
  'postulada',
  'evaluacion',
  'adjudicada',
  'oc_emitida',
  'pagada',
] as const;

export type PipelineEtapa = (typeof PIPELINE_ETAPAS)[number];

export interface EtapaConfig {
  key: PipelineEtapa;
  label: string;
  color: string;       // Tailwind bg class for column header
  textColor: string;   // Tailwind text class
  badgeColor: string;  // For badges and chips
}

export const ETAPA_CONFIG: Record<PipelineEtapa, EtapaConfig> = {
  descubierta: {
    key: 'descubierta',
    label: 'Descubierta',
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    badgeColor: 'bg-slate-100 text-slate-700',
  },
  seguimiento: {
    key: 'seguimiento',
    label: 'Seguimiento',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  preparacion: {
    key: 'preparacion',
    label: 'En Preparación',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  postulada: {
    key: 'postulada',
    label: 'Postulada',
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  evaluacion: {
    key: 'evaluacion',
    label: 'En Evaluación',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  adjudicada: {
    key: 'adjudicada',
    label: 'Adjudicada',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-700',
  },
  oc_emitida: {
    key: 'oc_emitida',
    label: 'OC Emitida',
    color: 'bg-teal-500',
    textColor: 'text-teal-700',
    badgeColor: 'bg-teal-100 text-teal-700',
  },
  pagada: {
    key: 'pagada',
    label: 'Pagada',
    color: 'bg-emerald-600',
    textColor: 'text-emerald-700',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
};

export const ETAPA_LIST = PIPELINE_ETAPAS.map((key) => ETAPA_CONFIG[key]);

export interface PipelineItem {
  id: string;
  user_id: string;
  oportunidad_id: string;
  oportunidad_tipo: 'compra_agil' | 'licitacion' | 'manual';
  etapa: PipelineEtapa;
  titulo: string;
  institucion: string | null;
  monto_estimado: number | null;
  fecha_cierre: string | null;
  match_score: number;
  notas: string | null;
  archivos: { nombre: string; url: string; fecha: string }[];
  asignado_a: string | null;
  etapa_historial: { etapa: PipelineEtapa; fecha: string; usuario_id: string }[];
  posicion: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineFilters {
  search?: string;
  asignado_a?: string;
  fechaCierreDesde?: string;
  fechaCierreHasta?: string;
  montoMin?: number;
  montoMax?: number;
  oportunidad_tipo?: string;
}
