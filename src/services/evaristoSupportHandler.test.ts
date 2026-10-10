/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. */
import { describe, expect, it } from 'vitest';
import { INCOMPLETE_REPLY } from '../../supabase/functions/_shared/evaristoSafety';
import { createSupportHarness, modelResponse } from './testHelpers/evaristoSupportHarness';

const CODE = '2239-5-LR26';
const OTHER_CODE = '123-4-LE26';
const conversation = { id: 'conversation-1', user_id: 'owner-1', contexto: { codigo_activo: CODE, pantalla: 'Licitación' } };
const request = (content: string, extra: Record<string, unknown> = {}) => ({
  messages: [{ role: 'user', content }], contexto: { page: 'Dashboard', canal: 'app' }, ...extra,
});
const connectedExtension = { extension: { claves_activas: 1, ultima_actividad: new Date().toISOString() } };

describe('Evaristo real handler with fully local dependencies', () => {
  it.each([
    ['¿Qué documentos necesito para inscribirme?', 'requirements'],
    ['¿Pongo stock simbólico para terminar?', 'commercial_terms'],
    ['No hay respuestas en el foro del convenio', 'forum'],
    ['¿El botón con la manito es participar?', 'interface'],
  ])('gates %s before any unsupported model fetch or tool execution (%s)', async (question, intent) => {
    const h = createSupportHarness({ conversations: [conversation], context: connectedExtension });
    const { body, response } = await h.run(request(question, { conversacion_id: conversation.id }));
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ estado_respuesta: 'needs_evidence', codigo_activo: CODE, memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(intent === 'interface' ? 0 : 1);
    expect(h.fetch.mock.calls.every(([url]) => url.endsWith('/experto-consultar'))).toBe(true);
    expect(h.rows.evaristo_acciones).toHaveLength(0);
    expect(h.rows.evaristo_mensajes).toHaveLength(2);
    expect(h.rows.evaristo_mensajes[1]).toMatchObject({ contenido: body.reply, meta: { modelo: 'deterministic', solicitudes_ia: 0, ultimo_http_ia: null, evidencia_documental: intent === 'interface' ? 'no_consultada' : 'no_verificable', estado_respuesta: 'needs_evidence' } });
  });

  it('recovers the owned conversation code after leaving its page', async () => {
    const h = createSupportHarness({ conversations: [conversation] });
    const { body } = await h.run(request('¿Qué requisitos hay?', { conversacion_id: conversation.id }));
    expect(body.codigo_activo).toBe(CODE);
    expect(body.reply).toContain(`/experto/libro/${CODE}`);
    expect(h.rpc).toHaveBeenCalledWith('evaristo_contexto', { p_codigo: CODE });
    expect(h.rows.evaristo_conversaciones[0].contexto).toMatchObject({ codigo_activo: CODE, codigo: CODE, codigo_origen: 'conversation' });
    for (const query of h.queries.filter(q => q.table === 'evaristo_conversaciones' && q.operation === 'select')) {
      expect(query.filters).toContainEqual({ column: 'user_id', operator: 'eq', value: 'owner-1' });
    }
  });

  it('repairs legacy memory from an owned historical message', async () => {
    const h = createSupportHarness({
      conversations: [{ ...conversation, contexto: { codigo: null, pantalla: 'Dashboard' } }],
      messages: [
        { id: '001', conversacion_id: conversation.id, user_id: 'owner-1', rol: 'assistant', meta: { codigo: CODE } },
        { id: '002', conversacion_id: conversation.id, user_id: 'other-owner', rol: 'assistant', meta: { codigo: OTHER_CODE } },
      ],
    });
    const { body } = await h.run(request('¿Qué documentos necesito?', { conversacion_id: conversation.id }));
    expect(body.codigo_activo).toBe(CODE);
    expect(h.rows.evaristo_conversaciones[0].contexto).toMatchObject({ codigo_activo: CODE });
    const historyRead = h.queries.find(q => q.table === 'evaristo_mensajes' && q.columns === 'meta');
    expect(historyRead?.filters).toContainEqual({ column: 'user_id', operator: 'eq', value: 'owner-1' });
  });

  it('does not read or update another owner’s conversation', async () => {
    const foreign = { ...conversation, user_id: 'other-owner' };
    const h = createSupportHarness({ conversations: [foreign] });
    const { body } = await h.run(request('¿Qué documentos necesito?', { conversacion_id: conversation.id }));
    expect(body.codigo_activo).toBeNull();
    expect(body.conversacion_id).not.toBe(conversation.id);
    expect(h.rows.evaristo_conversaciones[0]).toEqual(foreign);
    expect(h.rows.evaristo_mensajes.every(row => row.conversacion_id === body.conversacion_id && row.user_id === 'owner-1')).toBe(true);
  });

  it('an explicit new process takes precedence over route and previous memory', async () => {
    const h = createSupportHarness({ conversations: [conversation] });
    const { body } = await h.run(request(`¿Qué requisitos tiene ${OTHER_CODE}?`, {
      conversacion_id: conversation.id, contexto: { codigo: CODE, codigo_activo: CODE },
    }));
    expect(body.codigo_activo).toBe(OTHER_CODE);
    expect(h.rpc).toHaveBeenCalledWith('evaristo_contexto', { p_codigo: OTHER_CODE });
    expect(h.rows.evaristo_conversaciones[0].contexto).toMatchObject({ codigo_activo: OTHER_CODE });
  });

  it('ambiguity neither executes tools nor overwrites existing process context', async () => {
    const h = createSupportHarness({ conversations: [conversation], context: connectedExtension });
    const { body } = await h.run(request(`Sincroniza ${CODE} o ${OTHER_CODE}`, {
      conversacion_id: conversation.id, contexto: { codigo: OTHER_CODE, extensionConectada: true },
    }));
    expect(body).toMatchObject({ estado_respuesta: 'clarification', contexto_ambiguo: true, codigo_activo: CODE, memoria_guardada: true });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.rows.evaristo_acciones).toHaveLength(0);
    expect(h.rows.evaristo_conversaciones[0].contexto).toEqual(conversation.contexto);
    expect(h.rows.evaristo_mensajes).toHaveLength(2);
  });

  it.each(['length', 'max_tokens', 'content_filter'])('discards truncated output with finish_reason=%s and persists the safe fallback', async finishReason => {
    const unsafeOriginal = 'Activa el producto y completa el formulario aunque';
    const h = createSupportHarness({ fetchResults: [modelResponse(unsafeOriginal, finishReason)] });
    const { body } = await h.run(request('Hola, orientame'));
    expect(body).toMatchObject({ reply: INCOMPLETE_REPLY, estado_respuesta: 'incomplete', memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.rows.evaristo_mensajes[1]).toMatchObject({ contenido: INCOMPLETE_REPLY, meta: { finish_reason: finishReason, estado_respuesta: 'incomplete' } });
    expect(JSON.stringify(h.rows)).not.toContain(unsafeOriginal);
  });

  it('rejects unsupported model claims even for a normally safe question', async () => {
    const h = createSupportHarness({ fetchResults: [modelResponse('Ya leí las bases. Pon stock simbólico 1.')] });
    const { body } = await h.run(request('Orientame'));
    expect(body.estado_respuesta).toBe('needs_evidence');
    expect(body.reply).toContain('No uses precios ni stock ficticios');
    expect(body.reply).not.toContain('Ya leí las bases');
    expect(body.memoria_guardada).toBe(true);
  });

  it('persists both sides of the turn when every model returns HTTP failure', async () => {
    const h = createSupportHarness({ fetchResults: [1, 2, 3].map(() => new Response('Synthetic model diagnostic', { status: 503 })) });
    const { body } = await h.run(request('¿Cómo instalo la extensión de Chrome?'));
    expect(body).toMatchObject({ error: 'sin_respuesta', estado_respuesta: 'model_error', memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(3);
    expect(h.rows.evaristo_mensajes).toHaveLength(2);
    expect(h.rows.evaristo_mensajes[1]).toMatchObject({ contenido: body.reply, meta: { estado_respuesta: 'model_error', modelo: 'fallback', solicitudes_ia: 3, ultimo_http_ia: 503 } });
    expect(JSON.stringify(body)).not.toContain('Synthetic model diagnostic');
    expect(JSON.stringify(h.rows)).not.toContain('Synthetic model diagnostic');
  });

  it('persists failures when all mocked network calls throw', async () => {
    const h = createSupportHarness({ fetchResults: [1, 2, 3].map(() => new Error('Synthetic unavailable model')) });
    const { body } = await h.run(request('Hola'));
    expect(body).toMatchObject({ estado_respuesta: 'model_error', memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(3);
    expect(h.rows.evaristo_mensajes).toHaveLength(2);
  });

  it('persists a missing-model-configuration failure without fetching', async () => {
    const h = createSupportHarness({ modelKey: false });
    const { body } = await h.run(request('Hola'));
    expect(body).toMatchObject({ estado_respuesta: 'model_error', memoria_guardada: true });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.rows.evaristo_mensajes[1].contenido).toBe(body.reply);
  });

  it.each([
    { table: 'evaristo_mensajes', operation: 'insert' as const },
    { table: 'evaristo_conversaciones', operation: 'insert' as const },
    { table: 'evaristo_conversaciones', operation: 'update' as const },
  ])('visibly reports failed $operation into $table instead of claiming saved memory', async fail => {
    const h = createSupportHarness({ fail, conversations: fail.operation === 'update' ? [conversation] : [] });
    const { body } = await h.run(request('¿Qué documentos necesito?', fail.operation === 'update' ? { conversacion_id: conversation.id } : {}));
    expect(body.memoria_guardada).toBe(false);
    expect(body.reply).toContain('No pude guardar este turno');
    expect(body.estado_respuesta).toBe('needs_evidence');
    expect(h.rows.evaristo_mensajes).toHaveLength(0);
  });

  it('context-only greeting never claims to have read processed documentary clauses', async () => {
    const h = createSupportHarness({ context: {
      en_pantalla: { codigo: CODE, tipo: 'licitacion', bases_leidas: 8, organismo: 'Organismo de prueba', items_con_match: 1 },
    } });
    const { body } = await h.run({ modo: 'contexto', contexto: { codigo: CODE } });
    expect(body.saludo).toContain('documento(s) procesado(s)');
    expect(body.saludo).not.toMatch(/(?:ya\s+)?(?:leí|lei|leídas|leidas)\s+(?:las\s+)?bases/i);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.rows.evaristo_mensajes).toHaveLength(0);
  });

  it('inherits commercial safeguards through an inverted-question-mark follow-up', async () => {
    const h = createSupportHarness({ conversations: [conversation], context: connectedExtension });
    const { body } = await h.run(request('unused', {
      conversacion_id: conversation.id,
      messages: [
        { role: 'user', content: 'Estoy en condiciones por producto y solo veo servicios' },
        { role: 'assistant', content: 'Revisemos el documento oficial.' },
        { role: 'user', content: '¿Y cuál selecciono?' },
      ],
    }));
    expect(body.estado_respuesta).toBe('needs_evidence');
    expect(body.reply).toContain('No uses precios ni stock ficticios');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls[0][0]).toContain('/experto-consultar');
    expect(h.rows.evaristo_acciones).toHaveLength(0);
  });

  it('rejects truncated tool calls before any side effect can be enqueued', async () => {
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [modelResponse('', 'length', [{
      id: 'tool-1', type: 'function', function: { name: 'programar_accion', arguments: JSON.stringify({ tipo: 'sincronizar_licitacion', codigo: CODE }) },
    }])] });
    const { body } = await h.run(request(`Sincroniza ${CODE}`));
    expect(body).toMatchObject({ estado_respuesta: 'incomplete', reply: INCOMPLETE_REPLY, memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.rows.evaristo_acciones).toHaveLength(0);
    expect(h.queries.some(q => q.table === 'evaristo_acciones' && q.operation !== 'select')).toBe(false);
  });

  it('allows a complete legitimate tool response and links its action to persisted memory', async () => {
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [
      modelResponse('Voy a sincronizar el proceso.', 'tool_calls', [{
        id: 'tool-1', type: 'function', function: { name: 'programar_accion', arguments: JSON.stringify({ tipo: 'sincronizar_licitacion', codigo: CODE }) },
      }]),
      modelResponse('Quedó en cola para que lo tome la extensión.'),
    ] });
    const { body } = await h.run(request(`Sincroniza ${CODE}`));
    expect(body).toMatchObject({ estado_respuesta: 'ok', memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.rows.evaristo_acciones).toHaveLength(1);
    expect(h.rows.evaristo_acciones[0]).toMatchObject({ codigo: CODE, estado: 'pendiente', user_id: 'owner-1', conversacion_id: body.conversacion_id });
  });

  it('takes ticket ownership and contact from the authenticated user instead of injected identity', async () => {
    const h = createSupportHarness({ serviceKey: true, fetchResults: [
      modelResponse('Revisemos ese problema.'), new Response(JSON.stringify({ numero: 42 })),
    ] });
    const { body } = await h.run(request('No carga Inventario', { identidad: { email: 'other@example.test', userId: 'other-owner' } }));
    const ticketCall = h.fetch.mock.calls.find(([url]) => url.endsWith('/soporte-ticket'));
    expect(ticketCall).toBeDefined();
    expect(JSON.parse(String(ticketCall?.[1]?.body))).toMatchObject({ email: 'owner@example.test', user_id: 'owner-1' });
    expect(body.reply).toContain('owner@example.test');
    expect(body.reply).not.toContain('other@example.test');
    expect(body.ticket).toEqual({ numero: 42 });
    expect(body.memoria_guardada).toBe(true);
  });

  it('never accepts an arbitrary user ID for an anonymous support ticket', async () => {
    const h = createSupportHarness({ authenticated: false, serviceKey: true, fetchResults: [
      modelResponse('Revisemos ese problema.'), new Response(JSON.stringify({ numero: 43 })),
    ] });
    const { body } = await h.run(request('No carga la página', { identidad: { email: 'guest@example.test', userId: 'other-owner' } }));
    const ticketCall = h.fetch.mock.calls.find(([url]) => url.endsWith('/soporte-ticket'));
    expect(JSON.parse(String(ticketCall?.[1]?.body))).toMatchObject({ email: 'guest@example.test', user_id: null });
    expect(body.ticket).toEqual({ numero: 43 });
    expect(h.rows.evaristo_mensajes).toHaveLength(0);
  });


  it('makes a created ticket visible even when model configuration is missing', async () => {
    const h = createSupportHarness({ modelKey: false, serviceKey: true, fetchResults: [new Response(JSON.stringify({ numero: 44 }))] });
    const { body } = await h.run(request('No carga Inventario'));
    expect(body).toMatchObject({ ticket: { numero: 44 }, estado_respuesta: 'model_error', memoria_guardada: true });
    expect(body.reply).toContain('#44');
    expect(h.rows.evaristo_mensajes[1].contenido).toContain('#44');
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, false, 'true', 1])('does not forward a screenshot without strict per-turn consent (%j)', async consent => {
    const image = 'data:image/png;base64,aGVsbG8=';
    const h = createSupportHarness({ modelKey: false, serviceKey: true, fetchResults: [new Response(JSON.stringify({ numero: 45 }))] });
    const { body } = await h.run(request('No carga la página', { imagen: image, adjuntar_imagen_ticket: consent }));
    expect(body.captura_compartida_soporte).toBe(false);
    expect(body.reply).toContain('No compartí la captura');
    const call = h.fetch.mock.calls.find(([url]) => url.endsWith('/soporte-ticket'));
    expect(call).toBeDefined();
    const payload = JSON.parse(String(call?.[1]?.body));
    expect(payload).not.toHaveProperty('imagen');
    expect(payload.conversacion).toEqual([{ role: 'user', content: 'No carga la página' }]);
    expect(JSON.stringify(payload)).not.toContain(image);
  });

  it('includes the exact valid screenshot only after explicit per-turn consent', async () => {
    const image = 'data:image/png;base64,aGVsbG8=';
    const h = createSupportHarness({ modelKey: false, serviceKey: true, fetchResults: [new Response(JSON.stringify({ numero: 46 }))] });
    const { body } = await h.run(request('No carga la página', { imagen: image, adjuntar_imagen_ticket: true }));
    expect(body.captura_compartida_soporte).toBe(true);
    expect(body.reply).toContain('captura que autorizaste');
    expect(h.rows.evaristo_mensajes[1].meta).toMatchObject({ captura_compartida_soporte: true });
    expect(JSON.parse(String(h.fetch.mock.calls[0][1]?.body)).imagen).toBe(image);
  });

  it.each(['https://private.example/screenshot', 'data:image/svg+xml;base64,aGVsbG8=', 'data:image/png;base64,<script>'])('does not forward an invalid or remote image even with consent (%s)', async image => {
    const h = createSupportHarness({ modelKey: false, serviceKey: true, fetchResults: [new Response(JSON.stringify({ numero: 47 }))] });
    await h.run(request('No carga la página', { imagen: image, adjuntar_imagen_ticket: true }));
    expect(JSON.parse(String(h.fetch.mock.calls[0][1]?.body))).not.toHaveProperty('imagen');
  });

  it.each([false, true])('a screenshot alone does not create an automatic support ticket (consent=%j)', async consent => {
    const h = createSupportHarness({ modelKey: false, serviceKey: true });
    const { body } = await h.run(request('Te mando una captura', { imagen: 'data:image/png;base64,aGVsbG8=', adjuntar_imagen_ticket: consent }));
    expect(body.ticket).toBeNull();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('does not forward earlier conversation or extracted screenshot details in an automatic ticket', async () => {
    const h = createSupportHarness({ modelKey: false, serviceKey: true, fetchResults: [new Response(JSON.stringify({ numero: 48 }))] });
    await h.run(request('No carga', { messages: [
      { role: 'user', content: 'Contenido anterior privado' },
      { role: 'assistant', content: 'Dato leído de la captura anterior' },
      { role: 'user', content: 'No carga' },
    ] }));
    const payload = JSON.parse(String(h.fetch.mock.calls[0][1]?.body));
    expect(payload.conversacion).toEqual([{ role: 'user', content: 'No carga' }]);
    expect(JSON.stringify(payload)).not.toContain('captura anterior');
    expect(JSON.stringify(payload)).not.toContain('anterior privado');
  });

  it('reads an already attached interface screenshot without asking for it again or offering action tools', async () => {
    const image = 'data:image/png;base64,aGVsbG8=';
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [modelResponse('Veo el título Condiciones por producto y un campo vacío. No puedo confirmar el efecto del botón solo por su nombre.')] });
    const { body } = await h.run(request('¿El botón con la manito es participar?', { imagen: image }));
    expect(body.estado_respuesta).toBe('ok');
    expect(body.reply).not.toContain('Mándame una captura');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(h.fetch.mock.calls[0][1]?.body));
    expect(payload).not.toHaveProperty('tools');
    expect(payload.messages[0].content).toContain('describe solo el título');
    expect(payload.messages.at(-1).content).toContainEqual({ type: 'image_url', image_url: { url: image } });
    expect(h.rows.evaristo_acciones).toHaveLength(0);
  });

  it('a screenshot does not replace documentary evidence for tender requirements', async () => {
    const h = createSupportHarness({ fetchResults: [new Response('{}', { status: 402 })] });
    const { body } = await h.run(request('¿Qué requisitos exige?', { imagen: 'data:image/png;base64,aGVsbG8=', contexto: { codigo: CODE } }));
    expect(body.estado_respuesta).toBe('access_denied');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls[0][0]).toContain('/experto-consultar');
    expect(JSON.stringify(h.fetch.mock.calls[0])).not.toContain('data:image');
  });

  it('does not execute unsolicited tool calls returned during visual inspection', async () => {
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [modelResponse('Voy a sincronizar.', 'tool_calls', [{
      id: 'visual-action', type: 'function', function: { name: 'programar_accion', arguments: JSON.stringify({ tipo: 'sincronizar_licitacion', codigo: CODE }) },
    }])] });
    const { body } = await h.run(request('¿El botón con la manito es participar?', { imagen: 'data:image/png;base64,aGVsbG8=' }));
    expect(body.estado_respuesta).toBe('clarification');
    expect(body.reply).toContain('no ejecuté acciones');
    expect(h.rows.evaristo_acciones).toHaveLength(0);
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported documentary claims before executing accompanying tool calls', async () => {
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [modelResponse('Ya leí las bases. Voy a preparar la oferta.', 'tool_calls', [{
      id: 'tool-unsafe', type: 'function', function: { name: 'programar_accion', arguments: JSON.stringify({ tipo: 'preparar_oferta', codigo: CODE }) },
    }])] });
    const { body } = await h.run(request(`Orientame con ${CODE}`));
    expect(body.estado_respuesta).toBe('needs_evidence');
    expect(h.rows.evaristo_acciones).toHaveLength(0);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(body.memoria_guardada).toBe(true);
  });


  it('preserves a queued action and conversation when every subsequent model call fails', async () => {
    const h = createSupportHarness({ context: connectedExtension, fetchResults: [
      modelResponse('Voy a sincronizar el proceso.', 'tool_calls', [{
        id: 'tool-1', type: 'function', function: { name: 'programar_accion', arguments: JSON.stringify({ tipo: 'sincronizar_licitacion', codigo: CODE }) },
      }]),
      ...[1, 2, 3].map(() => new Response('Synthetic service outage', { status: 503 })),
    ] });
    const { body } = await h.run(request(`Sincroniza ${CODE}`));
    expect(body).toMatchObject({ estado_respuesta: 'action_only', memoria_guardada: true });
    expect(body.reply).toContain('en cola');
    expect(body.reply).toContain(CODE);
    expect(h.fetch).toHaveBeenCalledTimes(4);
    expect(h.rows.evaristo_acciones).toHaveLength(1);
    expect(h.rows.evaristo_acciones[0].conversacion_id).toBe(body.conversacion_id);
    expect(h.rows.evaristo_mensajes[1]).toMatchObject({ contenido: body.reply, meta: { estado_respuesta: 'action_only', solicitudes_ia: 4, ultimo_http_ia: 503 } });
  });

});
