/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { describe, expect, it } from "vitest";
import { contextAfterResponse, emptyEvaristoContext, evaristoStorageKey, normalizeProcessCode, processCodeFromHistory, processCodeInRoute, processContextForRequest, readEvaristoContext } from "./evaristoContext";

const A = "1234-56-LE26";
const B = "2222-3-COT26";
const C = "3333-7-LP26";
const routeA = `/licitaciones/${A}`;
const onA = { conversationId: "conversation-A", activeCode: A, lastRoute: routeA };

describe("contexto del proceso de Don Evaristo", () => {
  it("normaliza únicamente códigos completos y tolera rutas mal codificadas", () => {
    expect(normalizeProcessCode(" 1234-56-le26 ")).toBe(A);
    expect(normalizeProcessCode(`mira ${A}`)).toBeNull();
    expect(normalizeProcessCode({ codigo: A })).toBeNull();
    expect(processCodeInRoute(`/compras-agiles/${B.toLowerCase()}`)).toBe(B);
    expect(processCodeInRoute("/licitaciones/%E0%A4%A")).toBeNull();
    expect(processCodeInRoute("/dashboard")).toBeNull();
  });

  it("conserva el proceso de la conversación al volver al Dashboard", () => {
    expect(processContextForRequest(onA, "/dashboard")).toEqual({ codigo: null, codigo_activo: A });
    const after = contextAfterResponse(onA, { conversacion_id: "conversation-A", codigo_activo: A }, "/dashboard");
    expect(after.activeCode).toBe(A);
    expect(after.conversationId).toBe("conversation-A");
  });

  it("un código B resuelto por backend gana a la ficha A y sigue activo en el turno siguiente", () => {
    expect(processContextForRequest(emptyEvaristoContext(), routeA)).toEqual({ codigo: A, codigo_activo: null });
    const afterB = contextAfterResponse(onA, { conversacion_id: "conversation-A", codigo_activo: B }, routeA);
    // «¿Y sus documentos?» en la misma ficha no reinyecta el código A.
    expect(processContextForRequest(afterB, routeA)).toEqual({ codigo: null, codigo_activo: B });
    const onC = `/licitaciones/${C}`;
    expect(processContextForRequest(afterB, onC)).toEqual({ codigo: C, codigo_activo: B });
    expect(contextAfterResponse(afterB, { codigo_activo: C }, onC).activeCode).toBe(C);
  });

  it("no escoge entre dos códigos ambiguos ni pierde el último proceso confirmado", () => {
    expect(contextAfterResponse(onA, { contexto_ambiguo: true, codigo_activo: null }, routeA).activeCode).toBe(A);
    expect(contextAfterResponse(onA, { contexto_ambiguo: true, codigo_activo: B }, routeA).activeCode).toBe(A);
  });

  it("reinicia el proceso y el ID al empezar una conversación nueva", () => {
    const cleared = emptyEvaristoContext();
    expect(cleared).toEqual({ conversationId: null, activeCode: null, lastRoute: null });
    expect(processContextForRequest(cleared, "/dashboard")).toEqual({ codigo: null, codigo_activo: null });
    expect(processContextForRequest(cleared, routeA).codigo).toBe(A);
  });

  it("la respuesta del servidor puede borrar contexto pero respuestas antiguas sin campo no lo inventan", () => {
    expect(contextAfterResponse(onA, { codigo_activo: null }, routeA).activeCode).toBeNull();
    expect(contextAfterResponse(onA, { reply: "Hola" }, routeA).activeCode).toBe(A);
    expect(contextAfterResponse(onA, { conversacion_id: "new" }, routeA).activeCode).toBeNull();
    expect(contextAfterResponse(onA, { codigo_activo: "inventado" }, routeA).activeCode).toBeNull();
  });

  it("rehidrata meta.codigo_activo antes que meta.codigo y respeta la fila más reciente", () => {
    expect(processCodeFromHistory([{ meta: { codigo_activo: B, codigo: A } }, { meta: { codigo_activo: C } }])).toBe(B);
    expect(processCodeFromHistory([{ meta: { codigo: C } }, { meta: { codigo_activo: B } }])).toBe(C);
  });

  it("recupera meta.codigo histórico aunque el último mensaje antiguo se envió sin ruta", () => {
    expect(processCodeFromHistory([{ meta: { codigo: null } }, { meta: { codigo: A } }])).toBe(A);
    expect(processCodeFromHistory([{ meta: null }, { meta: { codigo: B.toLowerCase() } }])).toBe(B);
    expect(processCodeFromHistory([])).toBeNull();
  });

  it("no reanima contexto borrado ni toma una mención ambigua al rehidratar", () => {
    expect(processCodeFromHistory([{ meta: { codigo_activo: null } }, { meta: { codigo: A } }])).toBeNull();
    expect(processCodeFromHistory([{ meta: { contexto_ambiguo: true, codigo_activo: B } }, { meta: { codigo_activo: A } }])).toBe(A);
  });

  it("separa cuentas y sesiones anónimas y no reutiliza caché sin contexto válido", () => {
    expect(new Set([evaristoStorageKey("user-A"), evaristoStorageKey("user-B"), evaristoStorageKey(null)]).size).toBe(3);
    expect(readEvaristoContext(null)).toEqual(emptyEvaristoContext());
    expect(readEvaristoContext({ conversationId: 12, activeCode: "inventado" })).toEqual(emptyEvaristoContext());
    expect(readEvaristoContext(onA)).toEqual(onA);
    expect(readEvaristoContext(emptyEvaristoContext())).toEqual(emptyEvaristoContext());
  });
});
