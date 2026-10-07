import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
console.log('Browser started');
const external = [];
let failed = true;
const requests = [];
const tenant = '00000000-0000-0000-0000-000000000101';
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
  if (url.pathname.startsWith('/test-supabase/')) {
    requests.push(url);
    const name = url.pathname.split('/').pop();
    if (name === 'cliente_owner_id') return route.fulfill({json:tenant});
    if (name === 'cliente_inventario' || name === 'cliente_inventario_resumen') {
      if (failed) return route.fulfill({status:500,json:{code:'57014',message:'simulated test timeout'}});
      if (name === 'cliente_inventario_resumen') return route.fulfill({json:{total:16359,activos:16359,sin_stock:0,stock_bajo:0,incompletos:0,valor:12345,categorias:['Prueba']}});
      return route.fulfill({headers:{'content-range':'0-0/16359'},json:[{id:'00000000-0000-0000-0000-000000000201',cliente_id:tenant,sku:'TEST-1',nombre:'Producto de prueba',descripcion:'Descripción de prueba',categoria:'Prueba',precio_unitario:100,margen_minimo:20,stock_disponible:10,created_at:'2026-10-01',updated_at:'2026-10-01'}]});
    }
    return route.fulfill({json:[]});
  }
  return route.continue();
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5187/e2e/local-fixtures/index.html');
  console.log('Fixture loaded');
  const inventory = page.getByRole('region', { name: 'Página Inventario de prueba' });
  const calendar = page.getByRole('region', { name: 'Página Calendario de prueba' });
  await inventory.getByText('No pudimos cargar el resumen del inventario').waitFor();
  await inventory.getByText('No pudimos cargar el inventario', {exact:true}).waitFor();
  assert.equal(await inventory.getByText('16359',{exact:true}).count(),0);
  assert.equal(await calendar.getByText(/Hoy \(0\)/).count(),0);
  console.log('Initial errors verified');
  failed = false;
  for (let i=0; i<2; i++) await inventory.getByRole('button',{name:'Reintentar',exact:true}).first().click();
  await inventory.getByText('Producto de prueba',{exact:true}).waitFor();
  const dataRequests = requests.filter(url => url.pathname.endsWith('/cliente_inventario'));
  assert.ok(dataRequests.every(url => url.searchParams.get('cliente_id') === `eq.${tenant}`));
  assert.equal(dataRequests.at(-1).searchParams.get('select').split(',').length,16);
  console.log('Recovery verified');
  failed = true;
  await inventory.getByRole('button',{name:'Más',exact:true}).click();
  await page.getByRole('menuitem',{name:'Actualizar lista'}).click();
  await inventory.getByText('No pudimos cargar el resumen del inventario').waitFor();
  await inventory.getByText('No pudimos cargar el inventario',{exact:true}).waitFor();
  assert.equal(await inventory.getByText('Producto de prueba',{exact:true}).count(),0);
  assert.equal(await inventory.getByText(/16[.,]359/).count(),0);
  assert.equal(await inventory.getByText('Los datos anteriores están desactualizados y se han ocultado.').count(),2);
  await calendar.getByText('No pudimos cargar el calendario').waitFor();
  await calendar.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.locator('.fc-dayGridMonth-view').waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('calendar-fixture',{detail:'refresh-error'})));
  await calendar.getByText('Los datos anteriores están desactualizados y se han ocultado.').waitFor();
  assert.equal(await calendar.getByText(/Hoy \(/).count(),0);
  assert.equal(await calendar.locator('.fc').count(),0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('calendar-fixture',{detail:'loading'})));
  await calendar.getByText('Cargando el calendario…').waitFor();
  assert.equal(await calendar.getByText(/Hoy \(/).count(),0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('calendar-fixture',{detail:'refreshing'})));
  await calendar.getByText(/Los datos visibles son de la última consulta/).waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('calendar-fixture',{detail:'success'})));
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
  console.log('PASS: real Inventory page with simulated authenticated identity and intercepted synthetic API; real inventory hooks; initial/refetch errors hide rows and KPIs; explicit16column and tenant predicates; calendar whole-panel loading/error/cache handling;  inventory retry; real calendar mount/month/week navigation; source retry; render boundary recovery; shell intact; all external requests blocked; no data service requests or unexpected runtime errors (injected render error expected in React development).');
} finally { await browser.close(); }
