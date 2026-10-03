import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const page = await browser.newPage();
const external = [];
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
  return route.continue();
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5187/e2e/local-fixtures/index.html');
  const inventory = page.getByRole('region', { name: 'Inventario simulado' });
  await inventory.getByRole('button', { name: 'Reintentar' }).click();
  await inventory.getByText('Producto recuperado').waitFor();
  await page.getByText('No pudimos cargar el calendario').waitFor();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.locator('.fc-dayGridMonth-view').waitFor();
  const title = await page.locator('.fc-toolbar-title').textContent();
  await page.locator('.fc-next-button').click();
  assert.notEqual(await page.locator('.fc-toolbar-title').textContent(), title);
  await page.locator('.fc-prev-button').click();
  assert.equal(await page.locator('.fc-toolbar-title').textContent(), title);
  await page.locator('.fc-timeGridWeek-button').click();
  await page.locator('.fc-timeGridWeek-view').waitFor();
  assert.deepEqual(errors, [], 'real calendar must not emit runtime errors');
  await page.getByRole('button', { name: 'Simular fallo de render' }).click();
  const isolated = page.getByRole('region', { name: 'Render aislado' });
  await isolated.getByText('No pudimos mostrar el calendario').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Navegación disponible' }).count(), 1);
  await page.getByRole('button', { name: 'Restaurar render' }).click();
  await isolated.getByRole('button', { name: 'Reintentar' }).click();
  await isolated.getByText('Contenido recuperado').waitFor();
  assert.deepEqual(errors.filter(message => message !== 'isolated simulated render failure'), []);
  assert.ok(external.every(origin => origin === 'https://fonts.googleapis.com'), 'no data service request is allowed');
  await page.screenshot({ path: '/tmp/firmavb-calendar-verified.png', fullPage: true });
  console.log('PASS: inventory retry; real calendar mount/month/week navigation; source retry; render boundary recovery; shell intact; all external requests blocked; no data service requests or unexpected runtime errors (injected render error expected in React development).');
} finally { await browser.close(); }
