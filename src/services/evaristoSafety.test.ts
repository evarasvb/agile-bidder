/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. */
import { describe, expect, it } from 'vitest';
import { classifySupportIntent, containsUnsupportedAdvice, evidenceRequiredReply, isIncompleteReply, normalizeTenderCode, PURCHASE_AGILE_LIMIT_UTM, resolveActiveTender } from '../../supabase/functions/_shared/evaristoSafety';

describe('Evaristo incident safeguards', () => {
  it('retains the process after leaving its route', () => expect(resolveActiveTender({ message: '¿qué hago?', routeCode: null, storedCode: '2239-5-LR26' }).code).toBe('2239-5-LR26'));
  it('explicit new code wins over old route and memory', () => expect(resolveActiveTender({ message: 'Ahora 123-4-LE26', routeCode: '2239-5-LR26', storedCode: '2239-5-LR26' }).code).toBe('123-4-LE26'));
  it('new route wins over old memory', () => expect(resolveActiveTender({ message: '¿qué requisitos hay?', routeCode: '123-4-LE26', storedCode: '2239-5-LR26' }).code).toBe('123-4-LE26'));
  it('does not silently choose between two explicit codes', () => expect(resolveActiveTender({ message: '2239-5-LR26 o 123-4-LE26', storedCode: '2239-5-LR26' }).ambiguous).toBe(true));
  it('rejects arbitrary context values', () => expect(normalizeTenderCode('https://fake/2239-5-LR26')).toBeNull());
  it('validates and normalizes a hint', () => expect(resolveActiveTender({ message: 'sigamos', clientHint: ' 2239-5-lr26 ' }).code).toBe('2239-5-LR26'));
  it.each([
    ['Mis Condiciones Comerciales para Convenio Marco, condiciones por producto, solo veo servicios', 'commercial_terms'],
    ['¿Pongo stock simbólico?', 'commercial_terms'],
    ['Tengo productos a $1', 'commercial_terms'],
    ['No hay respuestas en el foro del convenio', 'forum'],
    ['¿Qué documentos necesito para inscribirme al convenio?', 'requirements'],
    ['¿Cómo postular?', 'requirements'],
    ['¿Ese botón verde con la manito es participar?', 'interface'],
  ])('routes the incident question %s without ungrounded generation', (question, expected) => expect(classifySupportIntent(question)).toBe(expected));
  it('keeps risk across a short user follow-up', () => expect(classifySupportIntent('no marco nada?', 'Mis condiciones por producto')).toBe('commercial_terms'));
  it('keeps risk across Spanish punctuation in follow-ups', () => expect(classifySupportIntent('¿y cuál selecciono?', 'Mis condiciones por producto')).toBe('commercial_terms'));
  it('does not route unrelated normal help away', () => expect(classifySupportIntent('¿Cómo instalo la extensión?')).toBeNull());
  it('does not block ordinary inventory editing', () => expect(classifySupportIntent('¿Cómo actualizo el stock de mi inventario?')).toBeNull());
  it('does not silently inherit risk from a new topic', () => expect(classifySupportIntent('¿Cómo instalo la extensión de Chrome en mi computadora?', 'foro sin respuestas')).toBeNull());
  it('forum reply never promises that publication is pending', () => { const reply = evidenceRequiredReply('forum','2239-5-LR26'); expect(reply).toContain('si la fecha ya pasó'); expect(reply).toContain('no ha verificado'); });
  it('commercial reply warns against fabricated fields and discloses missing reading', () => { const reply = evidenceRequiredReply('commercial_terms','2239-5-LR26'); expect(reply).toContain('No uses precios ni stock ficticios'); expect(reply).toContain('no ha consultado'); });
  it('offers a real next step to a plan-limited customer', () => expect(evidenceRequiredReply('requirements','2239-5-LR26')).toContain('Si el Libro te limita por tu plan'));
  it('asks for a process when none is known', () => expect(evidenceRequiredReply('requirements',null)).toContain('¿Cuál es el código'));
  it.each(['Pon stock simbólico 1', 'Asígnale un precio referencial', 'Ya leí las bases', 'Participar es obligatorio', 'Pon un stock de 1 unidad', 'He revisado las bases', 'Ya revisé las bases', 'Analicé las bases', 'Las bases exigen una garantía'])('rejects unsupported output %s', (reply) => expect(containsUnsupportedAdvice(reply)).toBe(true));
  it('does not flag ordinary navigation help', () => expect(containsUnsupportedAdvice('Abre Inventario desde el menú.')).toBe(false));
  it.each(['length','max_tokens','content_filter'])('rejects incomplete/filtered completion %s', reason => expect(isIncompleteReply(reason,'Texto incompleto')).toBe(true));
  it('detects the captured dangling forum reply', () => expect(isIncompleteReply(null,'Revisa Aclaraciones o en')).toBe(true));
  it('accepts an ordinary complete response', () => expect(isIncompleteReply('stop','Abre Inventario desde el menú.')).toBe(false));
  it('uses the current official Compra Ágil threshold', () => expect(PURCHASE_AGILE_LIMIT_UTM).toBe(100));
});
