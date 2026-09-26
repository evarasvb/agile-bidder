export function CampaignFeedback({ pieceId, results }: { pieceId: string; results: Readonly<Record<string, string>> }) {
  const message = results[pieceId];
  return message ? <p role="status" aria-live="polite" className="text-sm max-w-xl">{message}</p> : null;
}

export function CampaignHistoryError() {
  return <p role="alert">No se pudo consultar el historial. Esto no confirma que no existan envíos.</p>;
}
