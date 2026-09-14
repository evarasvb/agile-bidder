import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CampaignFeedback, CampaignHistoryError } from './CampaignFeedback';
import { normalizeCampaignResult } from '../../services/campaignResult';

describe('campaign feedback UI rendering', () => {
  it.each([
    [202, { total_objetivo: 1, total_procesados: 1, total_enviados: 0, total_exitosos: 0, total_errores: 0, total_inciertos: 1 }, 'Inciertos: 1', 'revisión manual'],
    [409, { codigo: 'already_claimed' }, 'ya fue reclamada', 'no vuelvas a enviarla'],
    [500, { codigo: 'contacts_failed' }, 'antes de iniciar los envíos', 'Revisa la pieza'],
    [500, {}, 'no pudo confirmar', 'revisión manual'],
  ] as const)('renders HTTP %i result only for its piece', (status, body, message, instruction) => {
    const outcome = normalizeCampaignResult(status, body);
    const results = { first: outcome.message };
    const html = renderToStaticMarkup(<CampaignFeedback pieceId="first" results={results} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(message);
    expect(html).toContain(instruction);
    expect(renderToStaticMarkup(<CampaignFeedback pieceId="second" results={results} />)).toBe('');
  });
  it('opening another piece cannot inherit the first result', () => {
    const results = { first: 'Inciertos: 1. Revisión manual.' };
    expect(renderToStaticMarkup(<CampaignFeedback pieceId="first" results={results} />)).toContain('Inciertos: 1');
    expect(renderToStaticMarkup(<CampaignFeedback pieceId="second" results={results} />)).toBe('');
  });
  it('history failures render an alert rather than an empty-history claim', () => {
    const html = renderToStaticMarkup(<CampaignHistoryError />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudo consultar');
    expect(html).not.toContain('Todavía no se ha enviado');
  });
});
