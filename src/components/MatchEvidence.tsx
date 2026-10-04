import type { assessMatch } from '@/lib/matchingContract';
export function MatchEvidenceNotice() {
  return <p className="text-xs text-muted-foreground">Similitud y cobertura de sugerencias no acreditan cumplimiento. Bases y anexos pendientes de validación.</p>;
}
export function MatchAssessmentSummary({ assessment }: { assessment: ReturnType<typeof assessMatch> }) {
  return <div className="text-xs space-y-1">
    <p>{assessment.state}{assessment.score !== null ? ` · Similitud ${assessment.score}/100` : ''}</p>
    <p>Compatibilidad: {assessment.compatibility === 'incompatible' ? 'incompatible o ambigua' : assessment.compatibility === 'unknown' ? 'desconocida' : 'sin conflicto detectado en el texto'}</p>
    {assessment.reasons.map(reason => <p key={reason}>{reason}</p>)}
    <p>Bases y anexos: sin validar</p>
  </div>;
}
