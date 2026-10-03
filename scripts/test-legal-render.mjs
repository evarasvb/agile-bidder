// Fixture de navegador local: no servidor, no Supabase, no IA, toda red bloqueada.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const bundled = await build({
  stdin: { contents: `import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { sanitizarHtmlLegal } from './src/lib/legalHtml';
    import { MensajeLegal } from './src/components/experto/MensajeLegal';
    const root = createRoot(document.getElementById('message'));
    window.legalFixture = { sanitize: sanitizarHtmlLegal, mount(props) {
      root.render(React.createElement(MensajeLegal, props));
    }};`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { '@': process.cwd() + '/src' },
});
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext();
const attempts = [];
await context.route('**/*', (route) => { attempts.push(route.request().url()); return route.abort(); });
const page = await context.newPage();
page.on('pageerror', (error) => console.error('Fixture page error:', error.message));
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
async function fixture(html, fuentes = []) {
  return page.evaluate(({ html, fuentes }) => {
    const safe = window.legalFixture.sanitize(html, fuentes);
    const target = document.getElementById('expert');
    target.innerHTML = safe;
    return { html: safe, text: target.textContent, links: [...target.querySelectorAll('a')].map((a) => ({ href: a.href, title: a.title, rel: a.rel })), dangerous: !!target.querySelector('script,img,svg,math,iframe,object,embed,form,input,style,[onerror],[onclick],[style],[id]') };
  }, { html, fuentes });
}
try {
  await page.setContent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'"><div id="expert"></div><div id="message"></div>');
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await check('formato benigno y texto jurídico se conservan', async () => {
    const r = await fixture('<p>Consulta <strong>legal</strong></p><ul><li>Dato fixture</li></ul>');
    assert.ok(r.html.includes('<strong>legal</strong>')); assert.ok(r.html.includes('<li>Dato fixture</li>')); assert.equal(r.dangerous, false);
  });
  for (const attack of ['<img src="https://example.invalid/x" onerror="window.fixtureExecuted=true">', '<svg onload="window.fixtureExecuted=true"><a href="javascript:fixture()">X</a></svg>', '<script>window.fixtureExecuted=true</script><p onclick="fixture()">Dato</p>', '<iframe srcdoc="<script>fixture()</script>"></iframe>', '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=fixture()>">', '<a href="https://example.invalid/falso">fuente falsa</a><p style="background:url(https://example.invalid/x)">Dato</p>']) {
    await check('elimina HTML activo / enlace libre: ' + attack.slice(0, 38), async () => {
      const r = await fixture(attack); assert.equal(r.dangerous, false); assert.equal(r.links.length, 0);
    });
  }
  await check('cita existente segura y título construido como atributo DOM', async () => {
    const title = 'Norma fixture " onmouseover="fixture() <b>texto</b>';
    const r = await fixture('<p>Argumento [1]</p>', [{ n: 1, fuente: title, url: 'https://example.invalid/norma' }]);
    assert.equal(r.links.length, 1); assert.equal(r.links[0].title, title); assert.equal(r.links[0].href, 'https://example.invalid/norma'); assert.match(r.links[0].rel, /noopener/); assert.equal(r.dangerous, false);
    assert.equal(await page.locator('#expert [onmouseover]').count(), 0);
  });
  for (const url of ['javascript:fixture()', 'data:text/html,fixture', '//example.invalid', '/relative', 'file:///tmp/fixture', 'https://u:p@example.invalid']) {
    await check('rechaza protocolo/destino no permitido: ' + url, async () => {
      const r = await fixture('[1]', [{ n: 1, fuente: 'Fixture', url }]); assert.equal(r.links.length, 0); assert.match(r.text, /fuente no verificable/);
    });
  }
  for (const fuentes of [[], [{ n: 1, fuente: '', url: 'https://example.invalid' }], [{ n: 1, fuente: 'A', url: 'https://example.invalid' }, { n: 1, fuente: 'B', url: 'https://example.invalid' }], [{ n: true, fuente: 'Boolean', url: 'https://example.invalid' }]]) {
    await check('cita ausente, incompleta o ambigua no crea enlace', async () => {
      const r = await fixture('[1]', fuentes); assert.equal(r.links.length, 0); assert.match(r.text, /fuente no verificable/); assert.ok(!r.html.includes('href="#"'));
    });
  }
  await check('cita no se sustituye dentro de atributos ni se acepta [0]', async () => {
    const r = await fixture('<p title="[1]">[0] Dato</p>', [{ n: 0, fuente: 'Fixture', url: 'https://example.invalid' }]); assert.equal(r.links.length, 0); assert.match(r.text, /fuente no verificable/);
  });
  await check('componente experto aplica sanitizer y cita real al render React', async () => {
    await page.evaluate(() => window.legalFixture.mount({ rol: 'exp', texto: '<p>Argumento fixture [1]</p><img src="https://example.invalid/x" onerror="fixture()">', fuentes: [{ n: 1, fuente: 'Norma fixture', url: 'https://example.invalid/norma' }] }));
    await page.waitForFunction(() => document.getElementById('message').textContent.includes('Argumento fixture'));
    assert.equal(await page.locator('#message img').count(), 0); assert.equal(await page.locator('#message a').count(), 1);
  });
  await check('componente usuario conserva literal malicioso y saltos sin ejecutar HTML', async () => {
    await page.evaluate(() => window.legalFixture.mount({ rol: 'yo', texto: '<img src=x onerror="fixture()">\nConsulta [1]' }));
    await page.waitForFunction(() => document.getElementById('message').textContent.includes('Consulta'));
    assert.equal(await page.locator('#message img').count(), 0); assert.match(await page.locator('#message').textContent(), /<img src=x/);
  });
  await check('sin ejecución de fixture maliciosa ni intentos de red', async () => {
    assert.equal(await page.evaluate(() => window.fixtureExecuted), undefined); assert.deepEqual(attempts, []);
  });
  console.log(JSON.stringify({ passed, failed: 0, outboundRequests: attempts.length }));
} finally { await context.close(); await browser.close(); }
