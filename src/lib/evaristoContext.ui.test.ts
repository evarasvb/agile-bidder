/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { existsSync } from "node:fs";
import path from "node:path";

// Integración real en React, con todos los servicios simulados en el navegador.
// No instala paquetes/browsers. Ejecutar con EVARISTO_BROWSER_TESTS=1 en un
// entorno que permita los sockets/procesos de Chromium.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : chromium.executablePath());
const A = "1234-56-LE26";
const B = "2222-3-COT26";
const C = "3333-7-LP26";
const harness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { EvaristoChat } from '/src/components/soporte/EvaristoChat.tsx';
function App() { window.testNavigate = useNavigate(); return React.createElement(EvaristoChat); }
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, {initialEntries:['/licitaciones/${A}']}, React.createElement(App)));
`;
const supabaseMock = `
const state = window.testChat = { user: JSON.parse(sessionStorage.getItem('test-owner') || '{"id":"user-A","email":"a@example.test"}'), requests:[], ticketRequests:[], rows:[], next:null, pending:false, resolve:null, conversationLookups:0 };
let onAuth;
state.changeUser = (user) => { state.user = user; sessionStorage.setItem('test-owner',JSON.stringify(user)); onAuth('SIGNED_IN', user ? {user} : null); };
const chain = (table) => {
  const query = { select(){return query}, eq(){return query}, order(){return query}, limit(){return query}, in(){return query},
    maybeSingle:async()=>{state.conversationLookups++;return {data:null}}, then:(resolve,reject)=>Promise.resolve({data:table==='evaristo_mensajes'?state.rows:[]}).then(resolve,reject) };
  return query;
};
export const supabase = {
  auth: { getUser:async()=>({data:{user:state.user}}), onAuthStateChange(callback){onAuth=callback; queueMicrotask(()=>callback('INITIAL_SESSION',{user:state.user}));return {data:{subscription:{unsubscribe(){}}}}} },
  functions:{ async invoke(name,{body}) {
    if(name==='soporte-ticket'){state.ticketRequests.push(body);return {data:{numero:17}}}
    if(body.modo==='contexto') return {data:{saludo:'Saludo contextual'}};
    state.requests.push(body);
    if(state.pending){state.pending=false;return new Promise(resolve=>{state.resolve=resolve})}
    const data=state.next??{reply:'Respuesta '+state.requests.length,conversacion_id:'conv-'+state.user?.id,codigo_activo:body.contexto.codigo||body.contexto.codigo_activo||null};
    state.next=null;return {data};
  }},
  from:chain, channel(){const c={on(){return c},subscribe(){return c}};return c}, removeChannel(){},
};
`;

// Intencionalmente solo este archivo necesita navegador; los helpers siempre se prueban.
describe.skipIf(process.env.EVARISTO_BROWSER_TESTS !== "1" || !existsSync(executablePath))("continuidad de EvaristoChat (React sin servicios)", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base: string;
  beforeAll(async () => {
    const mocks: Record<string, string> = {
      "/src/integrations/supabase/client": supabaseMock,
      "/src/hooks/useInventory": "export const useInventoryStats=()=>({data:{total:0}})",
      "/src/hooks/useExtensionStatus": "export const useExtensionStatus=()=>({isConnected:false})",
      "/src/components/ui/scroll-area": "export const ScrollArea=()=>null",
      "/src/components/ui/button": "import React from 'react';export const Button=({variant,size,...props})=>React.createElement('button',props)",
    };
    server = await createServer({
      configFile: false, logLevel: "silent", root: process.cwd(),
      server: { host: "127.0.0.1", port: 0 },
      esbuild: { jsx: "automatic" },
      plugins: [{
        name: "evaristo-test-services",
        resolveId(id) {
          if (id === "virtual:evaristo-harness") return "\0evaristo-harness";
          const source = id.startsWith("@/") ? `/src/${id.slice(2)}` : id;
          if (mocks[source]) return `\0mock:${source}`;
          if (id.startsWith("@/")) return path.resolve(process.cwd(), "src", id.slice(2)) + ".ts";
        },
        load(id) { if (id === "\0evaristo-harness") return harness; if (id.startsWith("\0mock:")) return mocks[id.slice(6)]; },
        configureServer(s) {
          s.middlewares.use((req, res, next) => {
            if (req.url !== "/test-chat") return next();
            res.setHeader("Content-Type", "text/html");
            res.end('<div id="root"></div><script type="module" src="/@id/__x00__evaristo-harness"></script>');
          });
        },
      }],
    });
    await server.listen();
    const address = server.httpServer!.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  }, 30000);
  afterAll(async () => { await browser?.close(); await server?.close(); });

  it("mantiene B fuera de su ficha, rehidrata y usa una nueva ficha C", async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.addInitScript(() => localStorage.setItem("fvb_evaristo_open", "1"));
    await page.goto(`${base}/test-chat`);
    const input = page.getByPlaceholder("Escribe tu duda… (puedes pegar un print)");
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    await page.evaluate((code) => { window.testChat.next = { reply: "Respuesta B", conversacion_id: "conv-user-A", codigo_activo: code }; }, B);
    await input.fill(`Analiza ${B}`);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText(`Proceso: ${B}`, { exact: false }).waitFor();
    await input.fill("¿Y sus documentos?");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 2", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[1].contexto)).toMatchObject({ codigo: null, codigo_activo: B });
    await page.evaluate(() => window.testNavigate("/dashboard"));
    await input.fill("Continúa");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 3", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[2].contexto)).toMatchObject({ codigo: null, codigo_activo: B });
    await page.evaluate((code) => window.testNavigate(`/licitaciones/${code}`), C);
    await input.fill("Revisa esta");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText(`Proceso: ${C}`, { exact: false }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[3].contexto.codigo)).toBe(C);
    await page.reload();
    await page.getByText(`Proceso: ${C}`, { exact: false }).waitFor();
    expect(errors).toEqual([]);
    await page.close();
  }, 30000);

  it("descarta respuestas tardías tras Nueva y cambio de cuenta; Nueva no resucita al recargar", async () => {
    const page = await browser.newPage();
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.addInitScript(() => localStorage.setItem("fvb_evaristo_open", "1"));
    await page.goto(`${base}/test-chat`);
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    const input = page.getByPlaceholder("Escribe tu duda… (puedes pegar un print)");
    await page.evaluate(() => { window.testChat.pending = true; });
    await input.fill("Consulta anterior");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.waitForFunction(() => !!window.testChat.resolve);
    await page.getByRole("button", { name: "Nueva", exact: true }).click();
    await page.evaluate((code) => window.testChat.resolve({ data: {reply:"Respuesta vieja",conversacion_id:"vieja",codigo_activo:code} }), B);
    await page.evaluate(() => window.testNavigate("/dashboard"));
    await input.fill("Nueva consulta");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 2", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[1])).toMatchObject({ conversacion_id:null,contexto:{codigo:null,codigo_activo:null} });
    expect(await page.getByText("Respuesta vieja", { exact: true }).count()).toBe(0);
    await page.evaluate(() => { window.testChat.pending = true; window.testChat.resolve = null; });
    await input.fill("Esperando A");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.waitForFunction(() => !!window.testChat.resolve);
    await page.evaluate(() => window.testChat.changeUser({id:"user-B",email:"b@example.test"}));
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    await page.evaluate((code) => window.testChat.resolve({data:{reply:"Privado A",conversacion_id:"conv-user-A",codigo_activo:code}}), A);
    await input.fill("Soy B");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 4", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[3])).toMatchObject({ conversacion_id:null,contexto:{codigo_activo:null},identidad:{userId:"user-B"} });
    expect(await page.getByText("Privado A", { exact: true }).count()).toBe(0);
    await page.getByRole("button", { name: "Nueva", exact: true }).click();
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fvb_evaristo_session:user-B")!).context)).toMatchObject({ conversationId:null,activeCode:null });
    await page.reload();
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.conversationLookups)).toBe(0);
    expect(await page.getByText("Proceso:", { exact: false }).count()).toBe(0);
    await input.fill("Después de Nueva");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 1", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[0])).toMatchObject({conversacion_id:null});
    await page.close();
  }, 30000);

  it("muestra fuentes seguras tras recargar y conserva una denegación HTTP 401 sin reintentar", async () => {
    const page = await browser.newPage();
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.addInitScript(() => localStorage.setItem("fvb_evaristo_open", "1"));
    await page.goto(`${base}/test-chat`);
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    await page.evaluate(() => {
      window.testChat.next = {
        reply: "Las bases lo indican [1].", conversacion_id: "conv-user-A", estado_respuesta: "answered_with_sources",
        fuentes: [
          { n: 1, fuente: "Bases administrativas.pdf", seccion: "Artículo 8", url: "https://example.com/bases?token=private-token" },
          { n: 64, fuente: "Ficha pública", seccion: "Documentos", url: "https://www.mercadopublico.cl/ficha?id=1234" },
        ],
      };
    });
    const input = page.getByPlaceholder("Escribe tu duda… (puedes pegar un print)");
    await input.fill("¿Qué dicen las bases?");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Las bases lo indican [1].", { exact: true }).waitFor();
    const sources = page.getByRole("region", { name: "Fuentes de la respuesta" });
    expect(await sources.getByRole("link").count()).toBe(1);
    expect(await sources.getByText("Sin enlace disponible", { exact: true }).count()).toBe(1);
    expect(await sources.textContent()).toContain("[64]");
    expect(await sources.getByRole("link").getAttribute("rel")).toContain("noopener");
    await page.waitForFunction(() => localStorage.getItem("fvb_evaristo_session:user-A")?.includes("Bases administrativas.pdf"));
    expect(await page.evaluate(() => localStorage.getItem("fvb_evaristo_session:user-A"))).not.toContain("private-token");
    await page.reload();
    await page.getByText("Bases administrativas.pdf", { exact: true }).waitFor();
    expect(await sources.getByRole("link").count()).toBe(1);
    await page.evaluate(() => { window.testChat.pending = true; });
    await input.fill("Consulta sin acceso");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.waitForFunction(() => !!window.testChat.resolve);
    await page.evaluate(() => window.testChat.resolve({ error: {
      message: "No mostrar este mensaje interno",
      context: new Response(JSON.stringify({ reply: "Tu sesión requiere ingresar de nuevo.", estado_respuesta: "access_denied", fuentes: [] }), { status: 401 }),
    } }));
    await page.getByText("Tu sesión requiere ingresar de nuevo.", { exact: true }).waitFor();
    expect(await page.getByText("No mostrar este mensaje interno", { exact: true }).count()).toBe(0);
    expect(await page.evaluate(() => window.testChat.requests.length)).toBe(1);
    await page.waitForFunction(() => localStorage.getItem("fvb_evaristo_session:user-A")?.includes('"estado_respuesta":"access_denied"'));
    await page.close();
  }, 30000);


  it("pide permiso por captura y lo limpia al reemplazar, quitar, Nueva, cambiar cuenta y enviar", async () => {
    const page = await browser.newPage();
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.addInitScript(() => localStorage.setItem("fvb_evaristo_open", "1"));
    await page.goto(`${base}/test-chat`);
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VuoAAAAASUVORK5CYII=", "base64");
    const choose = async (name: string) => {
      await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/png", buffer: pixel });
      await page.getByAltText("Vista previa de la captura").waitFor();
    };
    const consent = page.getByRole("checkbox", { name: "Incluir esta captura en el ticket para el equipo FirmaVB" });
    await choose("primera.png");
    await browserExpect(consent).not.toBeChecked();
    await consent.check();
    await choose("segunda.png");
    await browserExpect(consent).not.toBeChecked();
    await consent.check();
    await page.getByRole("button", { name: "Quitar captura" }).click();
    await browserExpect(consent).toHaveCount(0);
    await choose("tercera.png");
    await browserExpect(consent).not.toBeChecked();
    await consent.check();
    await page.getByRole("button", { name: "Nueva", exact: true }).click();
    await browserExpect(consent).toHaveCount(0);
    await choose("cuarta.png");
    await consent.check();
    await page.evaluate(() => window.testChat.changeUser({ id: "user-B", email: "b@example.test" }));
    // El saludo anterior tiene el mismo texto: esperamos el estado persistido
    // de la nueva cuenta y la desaparición del permiso, no un render viejo.
    await page.waitForFunction(() => localStorage.getItem("fvb_evaristo_session:user-B") !== null);
    await browserExpect(consent).toHaveCount(0);
    await choose("solo-chat.png");
    const input = page.getByPlaceholder("Escribe tu duda… (puedes pegar un print)");
    await input.fill("Revisa esta captura");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 1", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[0].adjuntar_imagen_ticket)).toBe(false);
    await choose("para-equipo.png");
    await consent.check();
    await input.fill("Incluye esta captura si abres un ticket");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 2", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[1].adjuntar_imagen_ticket)).toBe(true);
    await browserExpect(consent).toHaveCount(0);
    await input.fill("Continúa sin imagen");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 3", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[2])).toMatchObject({ imagen: null, adjuntar_imagen_ticket: false });
    await choose("ticket-manual.png");
    await page.getByRole("button", { name: "¿Prefieres que te contacte el equipo?" }).click();
    await browserExpect(page.getByAltText("Vista previa de la captura")).toHaveCount(1);
    await browserExpect(consent).not.toBeChecked();
    await consent.check();
    await page.getByPlaceholder("Cuéntanos tu caso…").fill("Revisa esta captura en mi caso");
    await page.getByRole("button", { name: "Enviar mi caso al equipo", exact: true }).click();
    await page.waitForFunction(() => window.testChat.ticketRequests.length === 1);
    expect(await page.evaluate(() => window.testChat.ticketRequests[0].imagen)).toMatch(/^data:image\/png;base64,/);
    await browserExpect(consent).toHaveCount(0);
    await choose("sin-permiso-ticket.png");
    await page.getByRole("button", { name: "¿Prefieres que te contacte el equipo?" }).click();
    await browserExpect(consent).not.toBeChecked();
    await page.getByPlaceholder("Cuéntanos tu caso…").fill("Caso sin compartir la captura");
    await page.getByRole("button", { name: "Enviar mi caso al equipo", exact: true }).click();
    await page.waitForFunction(() => window.testChat.ticketRequests.length === 2);
    expect(await page.evaluate(() => window.testChat.ticketRequests[1].imagen)).toBeUndefined();
    await browserExpect(consent).toHaveCount(0);
    await page.close();
  }, 30000);

  it("activa voz simulada tras el aviso, deja editar y cancela resultados tardíos sin autoenviar", async () => {
    const page = await browser.newPage();
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    // Un string autocontenido evita que esbuild introduzca __name/__publicField
    // externos al callback que Playwright serializa al contexto del navegador.
    await page.addInitScript({ content: `
      localStorage.setItem("fvb_evaristo_open", "1");
      class MockRecognition {
        constructor() {
          this.started = 0;
          this.aborted = 0;
          this.onresult = this.onstart = this.onend = this.onerror = this.lateResult = null;
          window.testVoice = this;
        }
        start() { this.started++; this.lateResult = this.onresult; this.onstart?.(); }
        stop() { this.onend?.(); }
        abort() { this.aborted++; }
        emit(text) { this.lateResult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }); }
        fail(error) { this.onerror?.({ error }); }
      }
      window.testVoiceConstructor = MockRecognition;
      Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: MockRecognition });
      Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: MockRecognition });
    ` });
    await page.goto(`${base}/test-chat`);
    await page.getByText("Saludo contextual", { exact: true }).waitFor();
    expect(pageErrors).toEqual([]);
    expect(await page.evaluate(() => typeof window.testVoiceConstructor === "function"
      && Object.getOwnPropertyDescriptor(window, "SpeechRecognition")?.value === window.testVoiceConstructor
      && Object.getOwnPropertyDescriptor(window, "webkitSpeechRecognition")?.value === window.testVoiceConstructor)).toBe(true);
    expect(await page.evaluate(() => typeof window.testVoice)).toBe("undefined");
    await page.getByRole("button", { name: "Dictar mensaje" }).click();
    await page.getByText("El motor de voz de tu navegador puede enviar el audio a un servicio remoto.", { exact: false }).waitFor();
    expect(await page.evaluate(() => typeof window.testVoice)).toBe("undefined");
    await page.getByRole("button", { name: "Iniciar dictado", exact: true }).click();
    expect(await page.evaluate(() => window.testVoice.started)).toBe(1);
    const input = page.getByRole("textbox", { name: "Mensaje para Don Evaristo" });
    await input.fill("Texto escrito");
    await page.evaluate(() => window.testVoice.emit("y dictado"));
    await browserExpect(input).toHaveValue("Texto escrito y dictado");
    expect(await page.evaluate(() => window.testChat.requests.length)).toBe(0);
    await page.getByRole("button", { name: "Detener dictado" }).click();
    await input.fill("Texto revisado por mí");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.getByText("Respuesta 1", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.testChat.requests[0].messages?.at(-1)?.content)).toBe("Texto revisado por mí");
    await page.getByRole("button", { name: "Dictar mensaje" }).click();
    await page.getByRole("button", { name: "Iniciar dictado", exact: true }).click();
    await page.getByRole("button", { name: "Nueva", exact: true }).click();
    await page.evaluate(() => window.testVoice.emit("Texto tardío"));
    await browserExpect(input).toHaveValue("");
    expect(await page.evaluate(() => window.testVoice.aborted)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Dictar mensaje" }).click();
    await page.getByRole("button", { name: "Iniciar dictado", exact: true }).click();
    await page.evaluate(() => window.testVoice.fail("not-allowed"));
    await page.getByText("No se autorizó el dictado. Puedes seguir escribiendo.", { exact: true }).waitFor();
    await input.fill("Puedo seguir escribiendo");
    expect(await page.evaluate(() => window.testChat.requests.length)).toBe(1);
    expect(pageErrors).toEqual([]);
    await page.close();
  }, 30000);

});

declare global {
  interface Window {
    testNavigate(path: string): void;
    testVoiceConstructor: unknown;
    testVoice: { started: number; aborted: number; emit(text: string): void; fail(error: string): void };
    testChat: {
      next: unknown;
      ticketRequests: Array<{ imagen?: string }>;
      conversationLookups: number;
      pending: boolean;
      resolve: (response: unknown) => void;
      requests: Array<{ contexto: { codigo: string | null; codigo_activo: string | null }; imagen?: string | null; adjuntar_imagen_ticket?: boolean; messages?: Array<{ role: string; content: string }> }>;
      changeUser(user: { id: string; email: string } | null): void;
    };
  }
}
