// Respaldo cuando Gemini falla por cuenta completa (cuota agotada, 429/503 en todos los
// modelos): reintenta con Claude (Anthropic). Devuelve el stream ya traducido al formato
// OpenAI-delta que usa el resto del código (choices[0].delta.content), así el llamador no
// necesita parsear dos formatos de streaming distintos.
export async function fetchClaudeComoOpenAI(
  messages: { role: string; content: string }[],
  opts: { modelo: string; maxTokens: number; temperature?: number }
): Promise<{ resp: Response; modelo: string } | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const resto = messages.filter((m) => m.role !== "system" && m.content).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  if (!resto.length) return null;

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: opts.modelo, max_tokens: opts.maxTokens, temperature: opts.temperature ?? 0.3, system: sys || undefined, messages: resto, stream: true }),
    });
  } catch (e) { console.error("claude fetch", String(e)); return null; }
  if (!r.ok || !r.body) { console.error("claude", opts.modelo, r.status, (await r.text().catch(() => "")).slice(0, 300)); return null; }

  const enc = new TextEncoder(); const dec = new TextDecoder();
  const traducido = new ReadableStream({
    async start(ctrl) {
      const reader = r.body!.getReader(); let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const ln of lines) {
            const s = ln.trim(); if (!s.startsWith("data:")) continue;
            const d = s.slice(5).trim(); if (!d) continue;
            try {
              const j = JSON.parse(d);
              if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: j.delta.text } }] })}\n\n`));
              }
            } catch { /* ignorar */ }
          }
        }
      } catch (e) { console.error("claude stream", String(e)); }
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
  });
  return { resp: new Response(traducido, { status: 200, headers: { "Content-Type": "text/event-stream" } }), modelo: `claude:${opts.modelo}` };
}
