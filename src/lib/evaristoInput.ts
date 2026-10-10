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
  const addition = transcript.trim();
  return addition ? `${text}${text && !/\s$/.test(text) ? " " : ""}${addition}` : text;
}

// Adaptador probado con un motor simulado, sin activar micrófonos en las pruebas.
// La API puede usar reconocimiento remoto: el aviso y el clic ocurren en la UI.
export function createEvaristoDictation(Recognition: EvaristoRecognitionConstructor, callbacks: {
  isCurrent(): boolean;
  onText(text: string): void;
  onInterim(text: string): void;
  onState(active: boolean): void;
  onNotice(message: string): void;
}): EvaristoDictation {
  let recognition = new Recognition();
  let active = false;
  let closed = false;
  let received = false;
  let stopping = false;
  let running = false;
  let generation = 0;
  let emptyEnds = 0;
  let interim = "";
  let stopNotice = "";
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let durationTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !closed && active && callbacks.isCurrent();
  const clearTimers = () => {
    clearTimeout(restartTimer); clearTimeout(durationTimer); clearTimeout(settleTimer);
    restartTimer = durationTimer = settleTimer = undefined;
  };
  const detach = () => {
    generation++;
    recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
  };
  // Cancel is silent: the owner clears its own draft on account/reset/unmount.
  const cancel = () => {
    closed = true; active = false; running = false;
    clearTimers(); detach();
    try { recognition.abort(); } catch { /* No hay sesión activa. */ }
  };
  const finish = (notice?: string) => {
    if (!current()) { cancel(); return; }
    cancel();
    callbacks.onState(false);
    callbacks.onNotice(notice || (interim
      ? "Dictado detenido. Quedó un borrador sin confirmar: revísalo antes de añadirlo."
      : received ? "Dictado terminado. Revisa y edita el texto antes de enviarlo."
        : "No se detectó voz. Puedes seguir escribiendo o iniciar otro dictado."));
  };
  const stop = (notice = "") => {
    if (!current() || stopping) return;
    stopping = true; stopNotice = notice;
    clearTimeout(restartTimer); restartTimer = undefined;
    clearTimeout(durationTimer); durationTimer = undefined;
    callbacks.onNotice("Terminando dictado… Espera el texto final antes de enviarlo.");
    if (!running) { finish(notice); return; }
    // stop() may return the last final result asynchronously. Do not abort it yet.
    settleTimer = setTimeout(() => finish(stopNotice || (interim
      ? "El navegador no confirmó el último fragmento. Revisa el borrador antes de añadirlo."
      : "Dictado detenido. Revisa y edita el texto antes de enviarlo.")), 3_000);
    try { recognition.stop(); }
    catch { finish("Dictado detenido. Revisa el texto y cualquier borrador pendiente."); }
  };
  const configure = () => {
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const version = ++generation;
    const seen = new Set<number>();
    let runReceived = false;
    const live = () => version === generation && current();
    recognition.onstart = () => {
      if (live()) callbacks.onNotice("Escuchando… Habla normalmente. Haz clic en Detener; no mantengas apretado.");
    };
    recognition.onresult = (event) => {
      if (!live()) return;
      const start = Number.isInteger(event.resultIndex) && event.resultIndex >= 0 ? event.resultIndex : 0;
      const pending: string[] = [];
      let finalized = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (typeof result?.[0]?.transcript !== "string") continue;
        const text = result[0].transcript.trim();
        if (!result.isFinal) { if (text) pending.push(text); continue; }
        if (i < start || seen.has(i)) continue;
        seen.add(i);
        finalized = true;
        if (text) {
          received = runReceived = true;
          emptyEnds = 0;
          callbacks.onText(text);
        }
      }
      // A withdrawn interim is not a confirmed deletion: keep the last draft
      // available for explicit review until a new interim/final supersedes it.
      if (pending.length || finalized) interim = pending.join(" ");
      callbacks.onInterim(interim);
    };
    recognition.onerror = ({ error }) => {
      if (!live()) return;
      // Only normal silence is recoverable within the explicitly started session.
      // Permission, device, network and aborted errors must never reopen the mic.
      if (error === "no-speech" && !stopping) {
        callbacks.onNotice("No se detecta voz. El navegador puede pausar; puedes detener o seguir hablando.");
        return;
      }
      finish(dictationErrorMessage(error));
    };
    recognition.onend = () => {
      if (!live()) return;
      running = false;
      if (stopping) { finish(stopNotice); return; }
      if (interim) { finish(); return; } // Never overwrite an unconfirmed fragment on restart.
      emptyEnds = runReceived ? 0 : emptyEnds + 1;
      if (emptyEnds > 2) { finish("El navegador se detuvo sin captar voz. Revisa la entrada de audio o vuelve a iniciar; puedes escribir."); return; }
      // Some browsers stop even in continuous mode. Fresh instance and index set
      // prevent losing new index-0 results or accepting events from an old run.
      detach();
      callbacks.onNotice("El navegador hizo una pausa. Retomando el dictado… Puedes detenerlo.");
      restartTimer = setTimeout(() => {
        restartTimer = undefined;
        if (!current()) { cancel(); return; }
        if (stopping) return;
        try {
          recognition = new Recognition(); configure(); running = true; recognition.start();
        } catch { finish("No se pudo retomar el dictado. El texto recibido se conserva; puedes escribir."); }
      }, 250);
    };
  };
  configure();
  return {
    start() {
      if (closed || active || !callbacks.isCurrent()) return;
      active = true; running = true;
      callbacks.onState(true);
      callbacks.onInterim("");
      callbacks.onNotice("Iniciando dictado… Espera a ver Escuchando; revisa si el navegador pide permiso.");
      durationTimer = setTimeout(() => {
        if (current()) stop("Se alcanzaron 5 minutos de dictado. Revisa el texto y vuelve a iniciar si lo necesitas.");
        else cancel();
      }, 5 * 60_000);
      try { recognition.start(); }
      catch { finish("No se pudo iniciar el dictado. Puedes seguir escribiendo."); }
    },
    stop: () => stop(),
    cancel,
  };
}
