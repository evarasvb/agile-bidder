import type { PipelineEtapa } from '@/components/pipeline/pipelineConstants';

const WON: PipelineEtapa[] = ['adjudicada', 'oc_emitida', 'pagada'];
const SUBMITTED: PipelineEtapa[] = ['postulada', 'evaluacion', ...WON, 'perdida'];

export function pipelineOutcomeMetrics(items: ReadonlyArray<{ etapa: PipelineEtapa }>) {
  const won = items.filter(item => WON.includes(item.etapa)).length;
  const lost = items.filter(item => item.etapa === 'perdida').length;
  const resolved = won + lost;
  return {
    submitted: items.filter(item => SUBMITTED.includes(item.etapa)).length,
    won,
    resolved,
    successRate: resolved ? Math.round(won / resolved * 100) : null,
  };
}
