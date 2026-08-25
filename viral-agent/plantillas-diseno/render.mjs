#!/usr/bin/env node
/**
 * Renderiza las plantillas .dc.html a PNG (1080x1350) para usar como
 * imagen_url en el calendario del bot publicador.
 *
 * Requiere Chromium: en local, `npx playwright install chromium` (el
 * paquete playwright-core ya está en devDependencies, solo falta el
 * binario del navegador). Si ya tienes un Chromium/Chrome instalado en
 * otra ruta, exporta CHROME_PATH apuntando a él.
 *
 * Uso: npm run render  (o: node render.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'viral-agent', 'imagenes');
const ASSETS_DIR = path.join(REPO_ROOT, 'public', 'media', 'academia');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Copiamos las imágenes reales junto al HTML temporal para que
// <img src="foto-enrique.jpg"> resuelva por ruta relativa.
for (const img of ['foto-enrique.jpg', 'libro-portada.jpg']) {
  fs.copyFileSync(path.join(ASSETS_DIR, img), path.join(HERE, img));
}

const TEMPLATES = [
  { file: 'Main.dc.html', out: 'pilar-mitos.png' },
  { file: 'Tips.dc.html', out: 'pilar-tips.png' },
  { file: 'Historias.dc.html', out: 'pilar-historias.png' },
  { file: 'Backstage.dc.html', out: 'pilar-backstage.png' },
  { file: 'PruebaSocial.dc.html', out: 'pilar-prueba-social.png' },
  { file: 'CTA.dc.html', out: 'pilar-cta.png' },
];

function extractStandaloneHtml(dcHtml) {
  const helmet = (dcHtml.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  const body = (dcHtml.match(/<\/helmet>([\s\S]*?)<\/x-dc>/) || [, ''])[1];
  return `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body style="margin:0;padding:0;">${body}</body></html>`;
}

const launchOpts = {};
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
if (process.env.HTTPS_PROXY) launchOpts.proxy = { server: process.env.HTTPS_PROXY };

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

for (const t of TEMPLATES) {
  const dcHtml = fs.readFileSync(path.join(HERE, t.file), 'utf8');
  const renderFile = path.join(HERE, `._render_${t.file}.html`);
  fs.writeFileSync(renderFile, extractStandaloneHtml(dcHtml));
  await page.goto(`file://${renderFile}`);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, t.out) });
  fs.unlinkSync(renderFile);
  console.log('rendered', t.out);
}

await browser.close();
for (const img of ['foto-enrique.jpg', 'libro-portada.jpg']) {
  fs.unlinkSync(path.join(HERE, img));
}
