import { describe, expect, it } from 'vitest';
import { pipelineOutcomeMetrics } from './pipelineMetrics';

describe('business outcomes', () => {
  it('includes losses in resolved outcomes', () => {
    const result = pipelineOutcomeMetrics([
      { etapa: 'adjudicada' },
      ...Array.from({ length: 9 }, () => ({ etapa: 'perdida' as const })),
    ]);
    expect(result).toEqual({ submitted: 10, won: 1, resolved: 10, successRate: 10 });
  });
  it('does not treat pending or declined opportunities as losses', () => {
    expect(pipelineOutcomeMetrics([
      { etapa: 'pagada' }, { etapa: 'perdida' }, { etapa: 'evaluacion' },
      { etapa: 'postulada' }, { etapa: 'no_participaremos' },
    ])).toEqual({ submitted: 4, won: 1, resolved: 2, successRate: 50 });
  });
  it('keeps success unknown until an outcome exists', () => {
    expect(pipelineOutcomeMetrics([{ etapa: 'postulada' }]).successRate).toBeNull();
    expect(pipelineOutcomeMetrics([]).successRate).toBeNull();
  });
});
