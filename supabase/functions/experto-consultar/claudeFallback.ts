// Respaldo cuando Gemini falla por cuenta completa (cuota agotada, 429/503 en todos los
// modelos): reintenta con Claude (Anthropic). Devuelve el stream ya traducido al formato
// OpenAI-delta que usa el resto del código (choices[0].delta.content), así el llamador no
// necesita parsear dos formatos de streaming distintos.
//
// El system prompt de los dos llamadores (abogado-consultar, experto-consultar) es un texto
// fijo (SYS_CHAT / SYS_INFORME / sysDocumento(tipo), sin datos del cliente interpolados) —
// va con cache_control para que Anthropic lo cachee cuando el prompt alcanza el mínimo de
// tokens que exige cada modelo (Anthropic no cachea bloques más cortos que eso, sin avisar).
// En la práctica solo beneficia a la generación de documentos (claude-sonnet-5, prompt largo);
// el modo chat (claude-haiku-4-5, SYS_CHAT corto) queda bajo ese mínimo y no se cachea — no es
// un error, solo no hay ahorro ahí. Marcar cache_control en un bloque corto es inofensivo: la
// API lo ignora y responde igual, sin cobrar de más.
export async function fetchClaudeComoOpenAI(
  messages: { role: string; content: string }[],
  opts: { modelo: string; maxTokens: number; temperature?: number; signal?: AbortSignal }
): Promise<{ resp: Response; modelo: string } | null> {
  if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException("Request aborted", "AbortError");
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const resto = messages.filter((m) => m.role !== "system" && m.content).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  if (!resto.length) return null;

  // Keep the existing 15s budget, and also stop when the original request is cancelled.
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(opts.signal?.reason);
  opts.signal?.addEventListener("abort", abortFromRequest, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Claude request timed out", "TimeoutError")), 15000);
  const cleanup = () => {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abortFromRequest);
  };
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.modelo,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.3,
        system: sys ? [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }] : undefined,
        messages: resto,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    cleanup();
    if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException("Request aborted", "AbortError");
    console.error("claude fetch", String(e));
    return null;
  }
  if (!r.ok || !r.body) {
    console.error("claude", opts.modelo, r.status, (await r.text().catch(() => "")).slice(0, 300));
    cleanup();
    return null;
  }

  const enc = new TextEncoder(); const dec = new TextDecoder();
  const reader = r.body.getReader();
  let cancelled = false, readerReleased = false;
  const abortReader = () => { void reader.cancel(controller.signal.reason).catch(() => undefined); };
  controller.signal.addEventListener("abort", abortReader, { once: true });
  if (controller.signal.aborted) abortReader();
  const traducido = new ReadableStream({
    async start(ctrl) {
      let buf = "", stopReason: string | null = null, messageStopped = false, failed = false;
      const event = (line: string) => {
        const s = line.trim(); if (!s.startsWith("data:")) return;
        const data = s.slice(5).trim(); if (!data) return;
        try {
          const item = JSON.parse(data);
          if (item.type === "error") { failed = true; return; }
          if (item.type === "message_delta" && typeof item.delta?.stop_reason === "string") {
            if (messageStopped) failed = true;
            stopReason = item.delta.stop_reason;
          }
          if (item.type === "message_stop") {
            if (!stopReason || messageStopped) failed = true;
            messageStopped = true;
          }
          if (item.type === "content_block_delta" && item.delta?.type === "text_delta" && typeof item.delta.text === "string") {
            if (messageStopped) { failed = true; return; }
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: item.delta.text } }] })}\n\n`));
          }
        } catch { failed = true; }
      };
      try {
        while (!controller.signal.aborted && !cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const line of lines) event(line);
        }
        buf += dec.decode();
        if (buf.trim() && !cancelled) event(buf);
      } catch { failed = true; }
      finally {
        cleanup();
        controller.signal.removeEventListener("abort", abortReader);
        readerReleased = true;
        reader.releaseLock();
      }
      if (cancelled) return;
      if (opts.signal?.aborted) {
        ctrl.error(opts.signal.reason ?? new DOMException("Request aborted", "AbortError"));
        return;
      }
      // message_delta supplies the reason; only message_stop confirms completion.
      // Unknown reasons, provider errors and truncated streams never become success.
      const finishReason = failed || controller.signal.aborted || !messageStopped ? "incomplete"
        : stopReason === "end_turn" || stopReason === "stop_sequence" ? "stop"
        : stopReason === "max_tokens" ? "length"
        : stopReason === "refusal" || stopReason === "content_filter" ? "content_filter"
        : "incomplete";
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\n`));
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
    cancel(reason) {
      cancelled = true;
      controller.abort(reason);
      cleanup();
      if (!readerReleased) return reader.cancel(reason);
    },
  });
  return { resp: new Response(traducido, { status: 200, headers: { "Content-Type": "text/event-stream" } }), modelo: `claude:${opts.modelo}` };
}
