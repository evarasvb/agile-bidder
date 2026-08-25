#!/usr/bin/env node
/**
 * Genera ~100 imágenes de post (1080x1350) variando el titular dentro del
 * mismo sistema visual de las 6 plantillas ya aprobadas (variantes.mjs
 * trae el banco de textos). Reusa portada y foto reales.
 *
 * Uso: node generar_variantes.mjs
 * Requiere Chromium (ver README.md / render.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { MITOS, TIPS, HISTORIAS, BACKSTAGE, PRUEBA_SOCIAL, CTA } from './variantes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'viral-agent', 'imagenes', 'variantes');
const ASSETS_DIR = path.join(REPO_ROOT, 'public', 'media', 'academia');

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const img of ['foto-enrique.jpg', 'libro-portada.jpg']) {
  fs.copyFileSync(path.join(ASSETS_DIR, img), path.join(HERE, img));
}

// Sin <link> a Google Fonts: en este pipeline batch no vale la pena la espera
// de red por 100 páginas — el fallback (sans-serif bold del sistema) ya se ve
// bien. El canvas editable en Claude Design sí carga Anton/DM Sans normalmente.
const BASE_STYLE = `* { box-sizing: border-box; } body { margin: 0; } a { color: #F5B301; } a:hover { color: #FF3B30; }`;
const ANTON = `font-family:'Anton',sans-serif;font-weight:900;letter-spacing:-0.01em;`;

function shell(inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head>
  <body><div style="width:1080px;height:1350px;position:relative;background:#0A1626;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden;">
  <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.05) 1.5px, transparent 1.5px);background-size:28px 28px;"></div>
  ${inner}
  </div></body></html>`;
}

function eyebrow(texto, dotColor = '#FF3B30') {
  return `<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:10px 20px;">
    <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span>
    <span style="color:#F6F5F1;font-size:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${texto}</span>
  </div>`;
}

function badge(texto, color, icono) {
  return `<div style="display:flex;align-items:center;gap:8px;background:${color}26;border:1px solid ${color}66;border-radius:999px;padding:10px 18px;">
    ${icono}
    <span style="color:${color};font-size:18px;font-weight:700;letter-spacing:0.04em;">${texto}</span>
  </div>`;
}

const ICONO_DESLIZA = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12h14M13 6l6 6-6 6" stroke="#F5B301" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_GUARDAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18l-6-4.5L6 21V3z" stroke="#FF3B30" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const ICONO_REEL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#FF3B30" stroke-width="2"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="#FF3B30"/></svg>`;
const ICONO_AMAZON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16l-1.5 12.5a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 6z" stroke="#F5B301" stroke-width="2" stroke-linejoin="round"/><path d="M8 6V5a4 4 0 018 0v1" stroke="#F5B301" stroke-width="2"/></svg>`;
const ESTRELLA = `<svg width="26" height="26" viewBox="0 0 24 24" fill="#F5B301"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6L12 2z"/></svg>`;

function footer() {
  return `<div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:center;padding:40px 64px;border-top:1px solid rgba(255,255,255,0.12);">
    <div style="display:flex;align-items:center;gap:14px;">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="#F5B301" stroke-width="2" stroke-linecap="round"/><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>
      <span style="color:#F6F5F1;font-size:24px;font-weight:700;">@surfeandolicitaciones</span>
    </div>
    <span style="color:#6E7A8A;font-size:20px;font-weight:500;">Véndele al Estado y no mueras en el intento</span>
  </div>`;
}

function fotoBox(estilo) {
  return `<div style="${estilo}border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.15);">
    <img src="foto-enrique.jpg" alt="Enrique Varas" style="width:100%;height:100%;object-fit:cover;display:block;"/>
  </div>`;
}

function portadaBox(estilo) {
  return `<div style="${estilo}border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.35);border:2px solid rgba(245,179,1,0.35);background:#0A1626;display:flex;align-items:center;justify-content:center;">
    <img src="libro-portada.jpg" alt="Portada del libro" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"/>
  </div>`;
}

function tplMitos([headline, sub]) {
  return shell(`
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Mitos y errores')}
      ${badge('DESLIZA', '#F5B301', ICONO_DESLIZA)}
    </div>
    <div style="position:relative;padding:72px 64px 0 64px;">
      <div style="${ANTON}font-size:108px;line-height:0.95;color:#FF3B30;">MITO:</div>
      <div style="${ANTON}font-size:52px;line-height:1.1;color:#F6F5F1;margin-top:14px;max-width:760px;">“${headline}”</div>
    </div>
    <div style="position:relative;padding:36px 64px 0 64px;max-width:600px;">
      <p style="color:#B9C2D0;font-size:28px;line-height:1.45;font-weight:500;margin:0;">${sub}</p>
    </div>
    ${fotoBox('position:absolute;right:64px;bottom:200px;width:300px;height:380px;')}
    ${footer()}
  `);
}

function tplTips([headline, sub]) {
  return shell(`
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Tips prácticos', '#F5B301')}
      ${badge('GUARDAR', '#FF3B30', ICONO_GUARDAR)}
    </div>
    <div style="position:relative;padding:96px 64px 0 64px;display:flex;align-items:flex-start;gap:24px;">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:10px;"><circle cx="12" cy="12" r="10" stroke="#F5B301" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#F5B301" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div style="${ANTON}font-size:60px;line-height:1.08;color:#F6F5F1;max-width:820px;">${headline}</div>
    </div>
    <div style="position:relative;padding:40px 64px 0 152px;max-width:600px;">
      <p style="color:#B9C2D0;font-size:28px;line-height:1.45;font-weight:500;margin:0;">${sub}</p>
    </div>
    ${footer()}
  `);
}

function tplHistorias([headline, sub]) {
  return shell(`
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Historias reales')}
      ${badge('REEL', '#FF3B30', ICONO_REEL)}
    </div>
    <div style="position:relative;padding:64px 64px 0 64px;">
      <svg width="76" height="60" viewBox="0 0 76 60" fill="none"><path d="M0 30C0 13 10 2 26 0v10c-8 2-13 8-13 16h13v24H0V30zM40 30C40 13 50 2 66 0v10c-8 2-13 8-13 16h13v24H40V30z" fill="#F5B301" opacity="0.85"/></svg>
    </div>
    <div style="position:relative;padding:20px 64px 0 64px;">
      <div style="${ANTON}font-size:56px;line-height:1.12;color:#F6F5F1;max-width:640px;">${headline}</div>
    </div>
    <div style="position:relative;padding:32px 64px 0 64px;max-width:560px;">
      <p style="color:#B9C2D0;font-size:28px;line-height:1.45;font-weight:500;margin:0;">${sub}</p>
    </div>
    ${fotoBox('position:absolute;right:64px;bottom:220px;width:260px;height:300px;')}
    ${footer()}
  `);
}

function tplBackstage([headline, sub]) {
  return shell(`
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Detrás de cámara', '#F5B301')}
      ${badge('REEL', '#FF3B30', ICONO_REEL)}
    </div>
    <div style="position:relative;padding:72px 64px 0 64px;">
      <div style="${ANTON}font-size:66px;line-height:1.05;color:#F6F5F1;max-width:820px;">${headline}</div>
    </div>
    <div style="position:relative;padding:32px 64px 0 64px;max-width:600px;">
      <p style="color:#B9C2D0;font-size:30px;line-height:1.5;font-weight:500;margin:0;">${sub}</p>
    </div>
    <div style="position:absolute;left:64px;right:64px;bottom:180px;display:flex;gap:28px;">
      ${fotoBox('flex:1;height:380px;')}
      ${portadaBox('flex:1;height:380px;')}
    </div>
    ${footer()}
  `);
}

function tplPruebaSocial(texto) {
  return shell(`
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Lo que dicen los lectores', '#F5B301')}
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div style="display:flex;align-items:center;gap:4px;">${ESTRELLA}${ESTRELLA}${ESTRELLA}${ESTRELLA}${ESTRELLA}</div>
        <span style="color:#6E7A8A;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Ejemplo</span>
      </div>
    </div>
    <div style="position:relative;margin:88px 64px 0 64px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:28px;padding:56px 52px;">
      <svg width="56" height="44" viewBox="0 0 76 60" fill="none"><path d="M0 30C0 13 10 2 26 0v10c-8 2-13 8-13 16h13v24H0V30zM40 30C40 13 50 2 66 0v10c-8 2-13 8-13 16h13v24H40V30z" fill="#FF3B30" opacity="0.85"/></svg>
      <div style="${ANTON}font-size:50px;line-height:1.15;color:#F6F5F1;margin-top:18px;">“${texto}”</div>
      <div style="margin-top:32px;color:#F5B301;font-size:24px;font-weight:700;">— Lector/a del libro</div>
    </div>
    ${fotoBox('position:absolute;right:64px;bottom:220px;width:170px;height:170px;border-radius:50%;')}
    ${footer()}
  `);
}

function tplCTA([headline, sub]) {
  return shell(`
    <div style="position:absolute;top:-180px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, rgba(255,59,48,0.18), transparent 70%);"></div>
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:56px 64px 0 64px;">
      ${eyebrow('Ya disponible', '#FF3B30')}
      ${badge('AMAZON', '#F5B301', ICONO_AMAZON)}
    </div>
    <div style="position:relative;padding:64px 64px 0 64px;">
      <div style="${ANTON}font-size:66px;line-height:1.05;color:#F6F5F1;max-width:860px;">${headline}</div>
    </div>
    <div style="position:relative;padding:28px 64px 0 64px;max-width:600px;">
      <p style="color:#B9C2D0;font-size:28px;line-height:1.4;font-weight:500;margin:0;">${sub}</p>
    </div>
    <div style="position:absolute;left:64px;bottom:250px;width:260px;height:360px;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.35);border:2px solid rgba(245,179,1,0.35);background:#0A1626;display:flex;align-items:center;justify-content:center;">
      <img src="libro-portada.jpg" alt="Portada del libro" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"/>
    </div>
    ${fotoBox('position:absolute;right:64px;bottom:250px;width:220px;height:280px;')}
    <div style="position:absolute;left:64px;right:64px;bottom:150px;display:flex;justify-content:center;">
      <div style="background:#FF3B30;border-radius:999px;padding:24px 56px;">
        <span style="color:#0A1626;${ANTON}font-size:34px;">LINK EN BIO →</span>
      </div>
    </div>
    ${footer()}
  `);
}

const GRUPOS = [
  { prefijo: 'mitos', datos: MITOS, tpl: tplMitos },
  { prefijo: 'tips', datos: TIPS, tpl: tplTips },
  { prefijo: 'historias', datos: HISTORIAS, tpl: tplHistorias },
  { prefijo: 'backstage', datos: BACKSTAGE, tpl: tplBackstage },
  { prefijo: 'prueba-social', datos: PRUEBA_SOCIAL, tpl: tplPruebaSocial },
  { prefijo: 'cta', datos: CTA, tpl: tplCTA },
];

const launchOpts = {};
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
if (process.env.HTTPS_PROXY) launchOpts.proxy = { server: process.env.HTTPS_PROXY };

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

let total = 0;
const manifest = [];
for (const grupo of GRUPOS) {
  for (let i = 0; i < grupo.datos.length; i++) {
    const html = grupo.tpl(grupo.datos[i]);
    const renderFile = path.join(HERE, `._v_${grupo.prefijo}_${i}.html`);
    fs.writeFileSync(renderFile, html);
    await page.goto(`file://${renderFile}`);
    await page.waitForTimeout(30);
    const nombre = `${grupo.prefijo}-${String(i + 1).padStart(2, '0')}.jpg`;
    await page.screenshot({ path: path.join(OUT_DIR, nombre), type: 'jpeg', quality: 88 });
    fs.unlinkSync(renderFile);
    manifest.push({ pilar: grupo.prefijo, archivo: nombre });
    total++;
    console.log('rendered', nombre);
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

await browser.close();
for (const img of ['foto-enrique.jpg', 'libro-portada.jpg']) {
  fs.unlinkSync(path.join(HERE, img));
}
console.log(`\nTotal generadas: ${total}`);
