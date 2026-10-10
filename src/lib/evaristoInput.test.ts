/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendEvaristoTranscript, canShareEvaristoImage, createEvaristoDictation, dictationErrorMessage, emptyEvaristoImageDraft, getEvaristoRecognition, reduceEvaristoImageDraft, type DictationResultEvent, type EvaristoRecognition } from "./evaristoInput";

describe("consentimiento por captura de Evaristo", () => {
  it("nunca comparte sin imagen y requiere una aceptación explícita", () => {
    let state = emptyEvaristoImageDraft();
    state = reduceEvaristoImageDraft(state, { type: "share", checked: true });
    expect(canShareEvaristoImage(state)).toBe(false);
    state = reduceEvaristoImageDraft(state, { type: "loaded", revision: 0, image: "data:image/png;base64,A" });
    expect(canShareEvaristoImage(state)).toBe(false);
    state = reduceEvaristoImageDraft(state, { type: "share", checked: true });
    expect(canShareEvaristoImage(state)).toBe(true);
    expect(canShareEvaristoImage(reduceEvaristoImageDraft(state, { type: "share", checked: false }))).toBe(false);
  });
  it.each(["quitar", "reemplazar", "enviar", "Nueva", "cambiar cuenta", "logout"])("%s borra imagen y aceptación; ignora cargas tardías", () => {
    let state = reduceEvaristoImageDraft(emptyEvaristoImageDraft(), { type: "loaded", revision: 0, image: "primera" });
    state = reduceEvaristoImageDraft(state, { type: "share", checked: true });
    state = reduceEvaristoImageDraft(state, { type: "clear", revision: 1 });
    expect(state).toEqual({ revision: 1, image: null, shareWithTeam: false });
    expect(reduceEvaristoImageDraft(state, { type: "loaded", revision: 0, image: "vieja" })).toBe(state);
    expect(reduceEvaristoImageDraft(state, { type: "loaded", revision: 1, image: "nueva" })).toEqual({ revision: 1, image: "nueva", shareWithTeam: false });
  });
});

class FakeRecognition implements EvaristoRecognition {
  static instance: FakeRecognition;
  lang = "";
  continuous = true;
  interimResults = true;
  maxAlternatives = 0;
  onstart: EvaristoRecognition["onstart"] = null;
  onresult: EvaristoRecognition["onresult"] = null;
  onerror: EvaristoRecognition["onerror"] = null;
  onend: EvaristoRecognition["onend"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { FakeRecognition.instance = this; }
}
const sessions: Array<ReturnType<typeof createEvaristoDictation>> = [];
function setup() {
  let current = true;
  const callbacks = { isCurrent: () => current, onText: vi.fn(), onInterim: vi.fn(), onState: vi.fn(), onNotice: vi.fn() };
  const session = createEvaristoDictation(FakeRecognition, callbacks);
  sessions.push(session);
  return { session, callbacks, engine: FakeRecognition.instance, invalidate: () => { current = false; } };
}
const result = (text = "Consulta dictada", isFinal = true): DictationResultEvent => ({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });

describe("dictado opcional de Evaristo sin micrófono real", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { sessions.splice(0).forEach(session => session.cancel()); vi.useRealTimers(); });
  it("detecta estándar, prefijo y ausencia sin pedir permisos", () => {
    expect(getEvaristoRecognition({ SpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(getEvaristoRecognition({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(getEvaristoRecognition({})).toBeNull();
    expect(getEvaristoRecognition(null)).toBeNull();
  });
  it("solo inicia por acción explícita, continuo y con provisional visible", () => {
    const { session, engine, callbacks } = setup();
    expect(engine.start).not.toHaveBeenCalled();
    expect(engine).toMatchObject({ lang: "es-CL", continuous: true, interimResults: true, maxAlternatives: 1 });
    session.start(); session.start();
    expect(engine.start).toHaveBeenCalledTimes(1);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("Espera a ver Escuchando"));
    engine.onstart!();
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("no mantengas apretado"));
    engine.onresult!(result("provisional", false));
    expect(callbacks.onText).not.toHaveBeenCalled();
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("provisional");
  });
  it("revisa interims, añade finales una vez y limpia el provisional confirmado", () => {
    const { session, engine, callbacks } = setup(); session.start();
    engine.onresult!(result("primero", false)); engine.onresult!(result("primero corregido", false));
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("primero corregido");
    engine.onresult!(result()); engine.onresult!(result());
    expect(callbacks.onText).toHaveBeenCalledExactlyOnceWith("Consulta dictada");
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("");
    session.stop(); engine.onend!();
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("Revisa y edita"));
  });
  it("conserva escritos y fragmentos largos sin recortar silenciosamente a4000", () => {
    expect(appendEvaristoTranscript("Texto editado", " más texto ")).toBe("Texto editado más texto");
    expect(appendEvaristoTranscript("Texto\n", "más")).toBe("Texto\nmás");
    expect(appendEvaristoTranscript("", " ")).toBe("");
    expect(appendEvaristoTranscript("", "x".repeat(5000))).toHaveLength(5000);
    const { session, engine, callbacks } = setup(); session.start(); engine.onresult!(result("x".repeat(5000)));
    expect(callbacks.onText).toHaveBeenLastCalledWith("x".repeat(5000));
  });
  it("no descarta finales después del índice64 en un dictado continuo", () => {
    const { session, engine, callbacks } = setup(); session.start();
    engine.onresult!({ resultIndex: 0, results: Array.from({length: 70}, (_,i) => ({isFinal:true, 0:{transcript:`Frase ${i}`}})) });
    expect(callbacks.onText).toHaveBeenCalledTimes(70);
    expect(callbacks.onText).toHaveBeenLastCalledWith("Frase 69");
  });
  it("reinicia tras pausa natural, reinicia índices y rechaza eventos del motor anterior", () => {
    const { session, engine, callbacks } = setup(); session.start(); engine.onresult!(result("primera"));
    const old = engine.onresult!; engine.onend!(); vi.advanceTimersByTime(250);
    const next = FakeRecognition.instance; expect(next).not.toBe(engine); expect(next.start).toHaveBeenCalledOnce();
    old(result("viejo")); next.onresult!(result("segunda"));
    expect(callbacks.onText.mock.calls.map(x=>x[0])).toEqual(["primera", "segunda"]);
    expect(callbacks.onState).not.toHaveBeenCalledWith(false);
  });
  it("conserva provisional al terminar sin final y no lo pisa con un reinicio", () => {
    const { session, engine, callbacks } = setup(); session.start(); engine.onresult!(result("fragmento pendiente", false));
    engine.onresult!({resultIndex:0,results:[]}); engine.onend!(); vi.advanceTimersByTime(1_000);
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("fragmento pendiente");
    expect(callbacks.onText).not.toHaveBeenCalled(); expect(engine.start).toHaveBeenCalledOnce();
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("borrador sin confirmar"));
  });
  it("detener espera final flush, no reinicia y cancelar descarta eventos tardíos", () => {
    const { session, engine, callbacks } = setup(); session.start(); session.stop(); session.stop();
    expect(engine.stop).toHaveBeenCalledTimes(1); expect(callbacks.onState).not.toHaveBeenCalledWith(false);
    engine.onresult!(result()); const lateResult = engine.onresult!; engine.onend!();
    vi.advanceTimersByTime(1_000); lateResult(result("tardío"));
    expect(engine.abort).toHaveBeenCalledTimes(1); expect(callbacks.onText).toHaveBeenCalledTimes(1);
    expect(FakeRecognition.instance).toBe(engine); expect(engine.onresult).toBeNull();
  });
  it("si el motor no termina, deja revisar el borrador después de3s sin perderlo", () => {
    const { session, engine, callbacks } = setup(); session.start(); engine.onresult!(result("pendiente", false)); session.stop();
    vi.advanceTimersByTime(2_999); expect(callbacks.onState).not.toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(1); expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("pendiente"); expect(engine.abort).toHaveBeenCalledOnce();
  });
  it("limita la sesión a5min y permite el resultado final al cerrar", () => {
    const { session, engine, callbacks } = setup(); session.start(); vi.advanceTimersByTime(5*60_000);
    expect(engine.stop).toHaveBeenCalledOnce(); engine.onresult!(result()); engine.onend!();
    expect(callbacks.onText).toHaveBeenCalledOnce(); expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("5 minutos"));
    vi.advanceTimersByTime(1_000); expect(FakeRecognition.instance).toBe(engine);
  });
  it.each(["desmontar", "Nueva", "cuenta", "logout", "enviar"])("cancelar por %s invalida resultados y reinicios pendientes", () => {
    const { session, engine, callbacks } = setup(); session.start(); const late = engine.onresult!;
    engine.onend!(); session.cancel(); late(result()); vi.advanceTimersByTime(5*60_000); session.start();
    expect(callbacks.onText).not.toHaveBeenCalled(); expect(engine.start).toHaveBeenCalledTimes(1); expect(FakeRecognition.instance).toBe(engine);
  });
  it("generation descarta resultados y no reabre otra sesión", () => {
    const { session, engine, callbacks, invalidate } = setup(); session.start(); const late = engine.onresult!;
    engine.onend!(); invalidate(); late(result()); vi.advanceTimersByTime(250);
    expect(callbacks.onText).not.toHaveBeenCalled(); expect(FakeRecognition.instance).toBe(engine);
  });
  it.each(["not-allowed", "service-not-allowed", "audio-capture", "network", "aborted"])("error %s ofrece texto, preserva borrador y nunca reinicia", (error) => {
    const { session, engine, callbacks } = setup(); session.start(); engine.onresult!(result("pendiente",false)); engine.onerror!({ error });
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(dictationErrorMessage(error));
    expect(callbacks.onState).toHaveBeenLastCalledWith(false); expect(callbacks.onInterim).toHaveBeenLastCalledWith("pendiente");
    vi.advanceTimersByTime(5*60_000); expect(engine.abort).toHaveBeenCalledOnce(); expect(engine.start).toHaveBeenCalledOnce();
  });
  it("solo silencio permite dos reinicios consecutivos sin bucle infinito", () => {
    const { session, callbacks } = setup(); session.start();
    for(let i=0;i<3;i++) { const e=FakeRecognition.instance; e.onerror!({error:"no-speech"}); e.onend!(); vi.advanceTimersByTime(250); }
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("se detuvo sin captar voz"));
  });
  it("un fallo al iniciar conserva la alternativa de texto", () => {
    const { session, engine, callbacks } = setup(); engine.start.mockImplementation(() => { throw new Error("detalle privado"); }); session.start();
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith("No se pudo iniciar el dictado. Puedes seguir escribiendo.");
  });
});
