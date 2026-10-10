/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { describe, expect, it, vi } from "vitest";
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
function setup() {
  let current = true;
  const callbacks = { isCurrent: () => current, onText: vi.fn(), onState: vi.fn(), onNotice: vi.fn() };
  const session = createEvaristoDictation(FakeRecognition, callbacks);
  return { session, callbacks, engine: FakeRecognition.instance, invalidate: () => { current = false; } };
}
const result = (text = "Consulta dictada", isFinal = true): DictationResultEvent => ({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });

describe("dictado opcional de Evaristo sin micrófono real", () => {
  it("detecta estándar, prefijo y ausencia sin pedir permisos", () => {
    expect(getEvaristoRecognition({ SpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(getEvaristoRecognition({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(getEvaristoRecognition({})).toBeNull();
    expect(getEvaristoRecognition(null)).toBeNull();
  });
  it("no inicia hasta start explícito y usa español sin resultados provisionales", () => {
    const { session, engine, callbacks } = setup();
    expect(engine.start).not.toHaveBeenCalled();
    expect(engine).toMatchObject({ lang: "es-CL", continuous: false, interimResults: false, maxAlternatives: 1 });
    session.start(); session.start();
    expect(engine.start).toHaveBeenCalledTimes(1);
    expect(callbacks.onState).toHaveBeenCalledWith(true);
  });
  it("solo añade resultados finales una vez y nunca envía mensajes", () => {
    const { session, engine, callbacks } = setup();
    session.start();
    engine.onresult!(result("provisional", false));
    expect(callbacks.onText).not.toHaveBeenCalled();
    engine.onresult!(result()); engine.onresult!(result());
    expect(callbacks.onText).toHaveBeenCalledExactlyOnceWith("Consulta dictada");
    engine.onend!();
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("Revisa y edita"));
  });
  it("preserva el texto escrito/editado y limita la transcripción", () => {
    expect(appendEvaristoTranscript("Texto editado", " más texto ")).toBe("Texto editado más texto");
    expect(appendEvaristoTranscript("Texto\n", "más")).toBe("Texto\nmás");
    expect(appendEvaristoTranscript("", " ")).toBe("");
    expect(appendEvaristoTranscript("", "x".repeat(5000))).toHaveLength(4000);
  });
  it("detener permite recibir el resultado final, cancelar lo descarta", () => {
    const { session, engine, callbacks } = setup();
    session.start(); session.stop(); session.stop();
    expect(engine.stop).toHaveBeenCalledTimes(1);
    engine.onresult!(result());
    const lateResult = engine.onresult!;
    session.cancel(); lateResult(result("tardío"));
    expect(engine.abort).toHaveBeenCalledTimes(1);
    expect(callbacks.onText).toHaveBeenCalledTimes(1);
    expect(engine.onresult).toBeNull();
  });
  it.each(["desmontar", "Nueva", "cuenta", "logout", "enviar"])("cancelar por %s invalida handlers tardíos", () => {
    const { session, engine, callbacks } = setup();
    session.start();
    const late = engine.onresult!;
    session.cancel(); late(result()); session.start();
    expect(callbacks.onText).not.toHaveBeenCalled();
    expect(engine.start).toHaveBeenCalledTimes(1);
  });
  it("generation descarta resultados aunque el motor todavía no haya terminado", () => {
    const { session, engine, callbacks, invalidate } = setup();
    session.start(); invalidate(); engine.onresult!(result()); engine.onend!();
    expect(callbacks.onText).not.toHaveBeenCalled();
  });
  it.each(["not-allowed", "service-not-allowed", "audio-capture", "no-speech", "network"])("error %s ofrece texto sin reiniciar ni exponer detalles", (error) => {
    const { session, engine, callbacks } = setup();
    session.start(); engine.onerror!({ error });
    expect(callbacks.onNotice).toHaveBeenLastCalledWith(dictationErrorMessage(error));
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(engine.abort).toHaveBeenCalledTimes(1);
    expect(engine.start).toHaveBeenCalledTimes(1);
  });
  it("un fallo al iniciar deja disponible el texto", () => {
    const { session, engine, callbacks } = setup();
    engine.start.mockImplementation(() => { throw new Error("detalle privado"); });
    session.start();
    expect(callbacks.onState).toHaveBeenLastCalledWith(false);
    expect(callbacks.onNotice).toHaveBeenLastCalledWith("No se pudo iniciar el dictado. Puedes seguir escribiendo.");
  });
});
