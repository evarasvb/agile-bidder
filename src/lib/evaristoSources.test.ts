/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { describe, expect, it } from "vitest";
import { readEvaristoAccessDeniedResponse, readEvaristoEvidence, readEvaristoSources, safeEvaristoSourceUrl } from "./evaristoSources";

const sources = [
  { n: 1, fuente: "Bases administrativas.pdf", seccion: "Artículo 8", url: null },
  { n: 3, fuente: "Mercado Público", seccion: "Ficha", url: "https://www.mercadopublico.cl/ficha?id=1234#documentos" },
];

describe("fuentes del chat de Don Evaristo", () => {
  it("conserva número, nombre y sección sin inventar enlaces para documentos privados", () => {
    expect(readEvaristoSources(sources)).toEqual(sources);
    expect(readEvaristoSources([{ n: 7, fuente: "  Bases.pdf  ", seccion: "  Pago\n\t  ", url: undefined }]))
      .toEqual([{ n: 7, fuente: "Bases.pdf", seccion: "Pago", url: null }]);
  });

  it.each([
    "javascript:alert(1)", "data:text/html,<h1>hola</h1>", "file:///etc/passwd", "/documento.pdf", "//example.com/base.pdf",
    "https://user:pass@example.com/base.pdf", "https://example.com/\nbase.pdf", "https:\\example.com/base.pdf",
    "https://example.com/bases?token=private", "https://example.com/bases?sig=private", "https://example.com/bases?X-Amz-Signature=private",
    "https://example.com/bases?X-Goog-Credential=private", "https://example.com/bases?access_token=private", "https://example.com/bases#token=private",
    "https://project.supabase.co/storage/v1/object/sign/bases.pdf", "https://project.supabase.co/storage/v1/object/authenticated/bases.pdf",
    "http://localhost/bases.pdf", "http://127.0.0.1/bases.pdf", "http://2130706433/bases.pdf", "http://10.0.0.1/bases.pdf",
    "http://172.16.2.1/bases.pdf", "http://192.168.1.1/bases.pdf", "http://169.254.169.254/latest", "http://100.64.0.1/bases.pdf",
    "https://intranet.local/bases.pdf", "http://[::1]/bases.pdf", "https://example.com/" + "x".repeat(2048),
  ])("descarta URL no pública o insegura: %s", (url) => {
    expect(safeEvaristoSourceUrl(url)).toBeNull();
    expect(readEvaristoSources([{ n: 1, fuente: "Bases", url }])).toEqual([{ n: 1, fuente: "Bases", seccion: null, url: null }]);
  });

  it("permite enlaces HTTP(S) públicos sin credenciales y no elimina consultas normales", () => {
    expect(safeEvaristoSourceUrl("https://www.mercadopublico.cl/licitacion?id=12&qs=abc#documentos"))
      .toBe("https://www.mercadopublico.cl/licitacion?id=12&qs=abc#documentos");
    expect(safeEvaristoSourceUrl("http://www.chilecompra.cl/documento.pdf")).toBe("http://www.chilecompra.cl/documento.pdf");
    expect(safeEvaristoSourceUrl({ url: "https://example.com" })).toBeNull();
  });

  it("ignora fuentes malformadas, números duplicados y campos internos", () => {
    expect(readEvaristoSources([
      null, [], "fuente", { n: "1", fuente: "No" }, { n: 0, fuente: "No" }, { n: 1.2, fuente: "No" }, { n: 1000, fuente: "No" },
      { n: 1, fuente: [] }, { n: 1, fuente: " " }, { n: 1, fuente: "Bases", contenido_privado: "secreto", url_firmada: "secreto" },
      { n: 1, fuente: "Duplicada" },
    ])).toEqual([{ n: 1, fuente: "Bases", seccion: null, url: null }]);
    expect(readEvaristoSources({ fuentes: sources })).toEqual([]);
    expect(readEvaristoSources(null)).toEqual([]);
  });

  it("limita cantidad, nombres y secciones sin cambiar los números de cita", () => {
    const result = readEvaristoSources(Array.from({ length: 100 }, (_, i) => ({ n: i + 1, fuente: "x".repeat(1000), seccion: "s".repeat(1000) })));
    expect(result).toHaveLength(64);
    expect(result[63].n).toBe(64);
    expect(result[0].fuente).toHaveLength(240);
    expect(result[0].seccion).toHaveLength(320);
  });

  it("rehidrata respuesta y meta del historial con el mismo contrato que persiste en caché", () => {
    const payload = { fuentes: sources, estados_fuentes: { bases_pdf: { estado: "ok", cantidad: 2 }, kb: { estado: "empty", cantidad: 0 } }, estado_respuesta: "answered_with_sources" };
    const fromResponse = readEvaristoEvidence({ ...payload, reply: "Según las bases [1].", solicitudes_ia: 1 });
    const row = { meta: { ...payload, user_id: "private-user", modelos: "private-model" } };
    expect(readEvaristoEvidence(row.meta)).toEqual(fromResponse);
    expect(fromResponse).toEqual(payload);
    const cache = JSON.parse(JSON.stringify({ version: 1, messages: [{ role: "assistant", content: "Según las bases [1].", ...fromResponse }] }));
    expect(readEvaristoEvidence(cache.messages[0])).toEqual(fromResponse);
  });

  it("elimina URLs privadas de la persistencia conservando las referencias", () => {
    const evidence = readEvaristoEvidence({ fuentes: [{ n: 1, fuente: "Bases.pdf", url: "https://example.com/base?token=secret-value", debug: "secret-value" }], debug: "secret-value" });
    const cache = JSON.stringify(evidence);
    expect(cache).not.toContain("secret-value");
    expect(readEvaristoEvidence(JSON.parse(cache))).toEqual({ fuentes: [{ n: 1, fuente: "Bases.pdf", seccion: null, url: null }] });
  });

  it("tolera historial antiguo, metadatos desconocidos y estados futuros", () => {
    for (const value of [undefined, null, [], "text", {}, { acciones: [] }, { fuentes: [], estado_respuesta: "inventado", estados_fuentes: [] }]) {
      expect(readEvaristoEvidence(value)).toEqual({});
    }
    for (const estado_respuesta of ["needs_evidence", "access_denied", "incomplete"]) {
      expect(readEvaristoEvidence({ estado_respuesta })).toEqual({ estado_respuesta });
    }
  });

  it("no propaga nombres peligrosos ni cantidades y estados no válidos", () => {
    const states = JSON.parse('{"__proto__":{"estado":"ok"},"constructor":{"estado":"ok"},"bases_pdf":{"estado":"ok","cantidad":-2,"texto":"privado"},"kb":{"estado":"error","cantidad":2.5},"inventada":{"estado":"pending"}}');
    expect(readEvaristoEvidence({ estados_fuentes: states })).toEqual({ estados_fuentes: { bases_pdf: { estado: "ok" }, kb: { estado: "error" } } });
    expect(readEvaristoEvidence(Object.create({ fuentes: sources, estado_respuesta: "ok" }))).toEqual({});
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`source_${i}`, { estado: "ok" }]));
    expect(Object.keys(readEvaristoEvidence({ estados_fuentes: many }).estados_fuentes!)).toHaveLength(20);
  });
});

describe("denegaciones HTTP del Experto en soporte", () => {
  it.each([401, 402, 403, 429])("recupera el reply previsto de HTTP %s sin consumir el cuerpo original", async (status) => {
    const body = { reply: "No pude consultar el Experto con tu acceso actual.", estado_respuesta: "access_denied", experto_http_status: status, fuentes: [] };
    const context = new Response(JSON.stringify(body), { status });
    expect(await readEvaristoAccessDeniedResponse({ context })).toEqual(body);
    expect(context.bodyUsed).toBe(false);
  });

  it("no usa mensajes arbitrarios, HTML, JSON inválido ni otros errores HTTP", async () => {
    const failures = [
      null, { message: "texto arbitrario" }, { context: {} },
      { context: new Response("<html>error</html>", { status: 401 }) },
      { context: new Response(JSON.stringify({ reply: "interno", estado_respuesta: "model_error" }), { status: 401 }) },
      { context: new Response(JSON.stringify({ reply: " ", estado_respuesta: "access_denied" }), { status: 402 }) },
      { context: new Response(JSON.stringify({ reply: "x".repeat(12_001), estado_respuesta: "access_denied" }), { status: 402 }) },
      { context: new Response(JSON.stringify({ reply: "error", estado_respuesta: "access_denied" }), { status: 500 }) },
    ];
    for (const failure of failures) expect(await readEvaristoAccessDeniedResponse(failure)).toBeNull();
  });
});
