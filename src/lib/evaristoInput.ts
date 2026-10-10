/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
export interface EvaristoImageDraft {
  revision: number;
  image: string | null;
  shareWithTeam: boolean;
}
export type EvaristoImageAction =
  | { type: "clear"; revision: number }
  | { type: "loaded"; revision: number; image: string }
  | { type: "share"; checked: boolean };
export const emptyEvaristoImageDraft = (): EvaristoImageDraft => ({ revision: 0, image: null, shareWithTeam: false });

// La autorización pertenece únicamente a la imagen actual. También descarta
// lecturas de archivo tardías tras quitar, reemplazar o enviar una captura.
export function reduceEvaristoImageDraft(state: EvaristoImageDraft, action: EvaristoImageAction): EvaristoImageDraft {
  if (action.type === "clear") return { revision: action.revision, image: null, shareWithTeam: false };
  if (action.type === "loaded") return action.revision === state.revision
    ? { revision: state.revision, image: action.image, shareWithTeam: false } : state;
  return { ...state, shareWithTeam: !!state.image && action.checked === true };
}

export function canShareEvaristoImage(draft: EvaristoImageDraft): boolean {
  return !!draft.image && draft.shareWithTeam === true;
}

export interface DictationResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
}
export interface EvaristoRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: DictationResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type EvaristoRecognitionConstructor = new () => EvaristoRecognition;
export interface EvaristoDictation {
  start(): void;
  stop(): void;
  cancel(): void;
}

export function getEvaristoRecognition(scope: unknown): EvaristoRecognitionConstructor | null {
  const browser = scope as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } | null;
  const candidate = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition;
  return typeof candidate === "function" ? candidate as EvaristoRecognitionConstructor : null;
}

export function dictationErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") return "No se autorizó el dictado. Puedes seguir escribiendo.";
  if (error === "audio-capture") return "No se pudo acceder al micrófono. Puedes seguir escribiendo.";
  if (error === "no-speech") return "No se detectó voz. Puedes escribir o iniciar otro dictado.";
  return "No se pudo completar el dictado. Puedes seguir escribiendo.";
}

export function appendEvaristoTranscript(text: string, transcript: string): string {
  const addition = transcript.trim().slice(0, 4_000);
  return addition ? `${text}${text && !/\s$/.test(text) ? " " : ""}${addition}` : text;
}

// Adaptador probado con un motor simulado, sin activar micrófonos en las pruebas.
// La API puede usar reconocimiento remoto: el aviso y el clic ocurren en la UI.
export function createEvaristoDictation(Recognition: EvaristoRecognitionConstructor, callbacks: {
  isCurrent(): boolean;
  onText(text: string): void;
  onState(active: boolean): void;
  onNotice(message: string): void;
}): EvaristoDictation {
  const recognition = new Recognition();
  recognition.lang = "es-CL";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let active = false;
  let closed = false;
  let received = false;
  let stopping = false;
  const seen = new Set<number>();
  const current = () => !closed && active && callbacks.isCurrent();
  const cancel = () => {
    closed = true;
    active = false;
    recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
    try { recognition.abort(); } catch { /* No hay sesión activa. */ }
  };
  recognition.onstart = () => { if (current()) callbacks.onNotice("Escuchando… Puedes detener el dictado cuando quieras."); };
  recognition.onresult = (event) => {
    if (!current()) return;
    const start = Number.isInteger(event.resultIndex) && event.resultIndex >= 0 ? event.resultIndex : 0;
    for (let i = start; i < Math.min(event.results.length, 64); i++) {
      const result = event.results[i];
      if (!result?.isFinal || seen.has(i) || typeof result[0]?.transcript !== "string") continue;
      seen.add(i);
      const text = result[0].transcript.trim().slice(0, 4_000);
      if (text) { received = true; callbacks.onText(text); }
    }
  };
  recognition.onerror = ({ error }) => {
    if (!current()) return;
    callbacks.onState(false);
    callbacks.onNotice(dictationErrorMessage(error));
    cancel();
  };
  recognition.onend = () => {
    if (!current()) return;
    callbacks.onState(false);
    callbacks.onNotice(received ? "Dictado terminado. Revisa y edita el texto antes de enviarlo." : "No se detectó voz. Puedes seguir escribiendo.");
    cancel();
  };
  return {
    start() {
      if (closed || active || !callbacks.isCurrent()) return;
      active = true;
      callbacks.onState(true);
      callbacks.onNotice("Iniciando dictado…");
      try { recognition.start(); }
      catch {
        if (current()) {
          callbacks.onState(false);
          callbacks.onNotice("No se pudo iniciar el dictado. Puedes seguir escribiendo.");
        }
        cancel();
      }
    },
    stop() {
      if (!current() || stopping) return;
      stopping = true;
      callbacks.onNotice("Terminando dictado…");
      try { recognition.stop(); }
      catch { callbacks.onState(false); callbacks.onNotice("Dictado detenido. Puedes seguir escribiendo."); cancel(); }
    },
    cancel,
  };
}
