Deno.serve(async (req) => {
  const key = Deno.env.get("GEMINI_API_KEY");
  const { modelos = [], kb = 10, effort = "low" } = await req.json().catch(() => ({}));
  const relleno = "Artículo 41.- Contenido mínimo de las Bases. Las Bases deberán contener, en lenguaje claro, comprensible, preciso y directo, los requisitos de admisibilidad, criterios de evaluación y garantías. ".repeat(Math.ceil(kb * 1024 / 200));
  const out: any = {};
  for (const m of modelos) {
    const t = Date.now();
    const body: any = { model: m, messages: [{ role: "system", content: "Eres un asesor de compras públicas chileno. Responde en 120 palabras citando [1]." }, { role: "user", content: "FUENTES:\n[1] " + relleno + "\n\nPREGUNTA: ¿Qué debe contener una base de licitación?" }], max_tokens: 400, stream: true };
    if (effort) body.reasoning_effort = effort;
    const rr = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let first = 0, chars = 0;
    if (rr.ok && rr.body) { const reader = rr.body.getReader(); const dec = new TextDecoder(); while (true) { const { done, value } = await reader.read(); if (done) break; const s = dec.decode(value); if (!first && s.includes('"content"')) first = Date.now() - t; chars += s.length; } }
    out[m] = { status: rr.status, ms_primer_token: first, ms_total: Date.now() - t, chars, err: rr.ok ? undefined : (await rr.text()).slice(0, 150) };
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
