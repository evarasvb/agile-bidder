/** Start Vite with this folder's config, then run with PW_CHROMIUM if needed.
 * Actual React component + actual Supabase JS client; synthetic identity/API.
 * No production or external connection is allowed.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const owner = '00000000-0000-0000-0000-000000000001';
const client = '00000000-0000-0000-0000-000000000003';
const original = { id: '00000000-0000-0000-0000-000000000005', tipo: 'carpeta_tributaria', nombre: 'previous-synthetic.pdf', archivo_url: `${owner}/previous-synthetic.pdf`, created_at: '2026-10-08T00:00:00Z' };
let document = { ...original };
let rejectWrite = true;
let releaseUpload;
let holdUpload = true;
let resolveUploadStarted;
const uploadStarted = new Promise(resolve => { resolveUploadStarted = resolve; });
const events = [];
const errors = [];
const external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
  if (!url.pathname.startsWith('/test-supabase/')) return route.continue();
  const method = request.method();
  if (url.pathname.endsWith('/rest/v1/cliente_documentos')) {
    if (method === 'GET') {
      assert.equal(url.searchParams.get('cliente_id'), `eq.${client}`);
      return route.fulfill({ json: [document] });
    }
    if (method === 'PATCH') {
      events.push({ type: 'update', path: url.searchParams.get('archivo_url') });
      assert.equal(url.searchParams.get('id'), `eq.${original.id}`);
      assert.equal(url.searchParams.get('cliente_id'), `eq.${client}`);
      assert.equal(url.searchParams.get('archivo_url'), `eq.${original.archivo_url}`);
      if (rejectWrite) return route.fulfill({ status: 400, json: { code: '23514', message: 'synthetic CHECK rejection' } });
      document = { ...document, ...request.postDataJSON() };
      return route.fulfill({ json: [document] });
    }
    throw new Error(`Unexpected synthetic database method: ${method}`);
  }
  if (url.pathname.includes('/storage/v1/object/documentos-empresa')) {
    if (method === 'POST') {
      const path = decodeURIComponent(url.pathname.split('/documentos-empresa/')[1]);
      events.push({ type: 'upload', path });
      if (holdUpload) await new Promise(resolve => { releaseUpload = resolve; resolveUploadStarted(); });
      return route.fulfill({ json: { Key: `documentos-empresa/${path}`, Id: 'synthetic-object' } });
    }
    if (method === 'DELETE') {
      const { prefixes } = request.postDataJSON();
      events.push(...prefixes.map(path => ({ type: 'remove', path })));
      return route.fulfill({ json: prefixes.map(name => ({ name })) });
    }
    throw new Error(`Unexpected synthetic storage method: ${method}`);
  }
  if (url.pathname.endsWith('/rpc/experto_plus_checklist')) return route.fulfill({ json: [] });
  throw new Error(`Unexpected synthetic API: ${method} ${url.pathname}`);
});
try {
  await page.goto('http://127.0.0.1:4194/', { waitUntil: 'domcontentloaded' });
  await page.getByText(original.nombre, { exact: false }).waitFor();
  // A disk fixture preserves lastModified across selections, just like the file picker.
  const uploadPath = '/tmp/firmavb-replacement-synthetic.pdf';
  writeFileSync(uploadPath, '%PDF-1.7 synthetic fixture');
  await page.locator('input[type=file]').first().setInputFiles(uploadPath);
  await uploadStarted;
  await page.waitForFunction(() => document.querySelector('button[aria-label="Subir Cédula del representante legal"]')?.hasAttribute('disabled'));
  assert.equal(await page.getByRole('button', { name: 'Eliminar Carpeta tributaria', exact: true }).isDisabled(), true);
  await page.locator('input[type=file]').nth(1).setInputFiles(uploadPath);
  assert.equal(events.filter(event => event.type === 'upload').length, 1, 'synchronous guard blocks concurrent synthetic input event');
  releaseUpload();
  holdUpload = false;
  await page.getByText('No se pudo registrar el archivo. El documento anterior se conserva.', { exact: true }).waitFor();
  assert.deepEqual(document, original, 'failed update preserves row and prior path');
  assert.ok(!events.some(event => event.type === 'remove' && event.path === original.archivo_url));
  const firstPath = events.find(event => event.type === 'upload').path;
  assert.deepEqual(events.filter(event => event.type === 'remove').map(event => event.path), [firstPath], 'compensation removes only this failed attempt');
  await page.getByRole('button', { name: 'Reemplazar Carpeta tributaria', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Reemplazar Carpeta tributaria"]')?.hasAttribute('disabled'));

  rejectWrite = false;
  await page.locator('input[type=file]').first().setInputFiles(uploadPath);
  await page.getByText('Documento guardado', { exact: true }).waitFor();
  await page.getByText('firmavb-replacement-synthetic.pdf', { exact: false }).waitFor();
  assert.equal(document.id, original.id, 'successful replacement updates same row');
  assert.notEqual(document.archivo_url, original.archivo_url);
  assert.equal(events.at(-1).type, 'remove');
  assert.equal(events.at(-1).path, original.archivo_url, 'old object removed only after confirmed update');
  const count = events.filter(event => event.type === 'upload').length;
  await page.locator('input[type=file]').first().setInputFiles(uploadPath);
  await page.getByText(/Este archivo ya se guardó/).waitFor();
  assert.equal(events.filter(event => event.type === 'upload').length, count, 'repeat upload is blocked after refetch');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  assert.ok(external.every(origin => origin === 'https://fonts.googleapis.com'), 'all external data requests blocked');
  await page.screenshot({ path: '/tmp/firmavb-documentos-verified.png', fullPage: true });
  console.log('PASS browser: actual component; synthetic authenticated identity; concurrent upload/delete blocked; prior document preserved on CHECK failure; only attempt object compensated; same-row update confirmed before old-file removal; duplicate selection blocked; no runtime errors or production calls.');
} finally { await browser.close(); }
