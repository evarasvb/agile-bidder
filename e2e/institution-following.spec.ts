import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

test('campanita abre el reclamo exacto y una segunda institución sin recarga', async ({ page }) => {
  await page.goto('/instituciones');
  await page.evaluate(() => { document.documentElement.dataset.session = 'same-document'; });
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await page.getByRole('link', { name: /Reclamo por no pago/ }).click();
  await expect(page).toHaveURL(/rut=fixture-0/);
  await expect(page).toHaveURL(/aviso=claim-1/);
  await expect(page.getByRole('heading', { name: 'Institución de prueba 1', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toContainText('Detalle exacto del reclamo recibido');
  await expect(page.getByText('Noticia reciente fixture-0', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('read-notice'))).toBe('claim-1');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await page.getByRole('link', { name: /Segundo reclamo en otra institución/ }).click();
  await expect(page).toHaveURL(/rut=fixture-1/);
  await expect(page.getByRole('heading', { name: 'Institución de prueba 2', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toContainText('Detalle de institución dos');
  expect(await page.evaluate(() => document.documentElement.dataset.session)).toBe('same-document');
});

test('aviso antiguo sin RUT conserva la noticia fuera de la lista reciente', async ({ page }) => {
  await page.goto('/instituciones');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await page.getByRole('link', { name: /Noticia antigua de institución/ }).click();
  await expect(page).toHaveURL(/aviso=legacy-news/);
  await expect(page.getByRole('heading', { name: 'Institución de prueba 2', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toContainText('Contenido conservado del aviso antiguo');
  await expect(page.getByRole('region', { name: 'Evento del aviso' }).getByRole('link')).toHaveAttribute('href', 'https://example.invalid/noticia');
  await expect(page.getByText('Noticia reciente fixture-1', { exact: true })).toBeVisible();
});

test('lista muestra doce instituciones y abre la duodécima', async ({ page }) => {
  await page.goto('/instituciones');
  await expect(page.getByRole('button', { name: 'Dejar', exact: true })).toHaveCount(12);
  await page.getByText('Institución de prueba 12', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Institución de prueba 12', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/rut=fixture-11/);
});

for (const [scenario, expected] of [ ['empty', /Todavía no sigues ninguna institución/], ['error', /No pudimos cargar tus instituciones/], ['detail-error', /No pudimos cargar.*información|No pudimos cargar.*institución/i] ] as const) {
  test(`estado ${scenario} muestra salida clara`, async ({ page }) => {
    await page.addInitScript(value => sessionStorage.setItem('scenario', value), scenario);
    await page.goto('/instituciones?rut=fixture-0');
    await expect(page.getByText(expected)).toBeVisible();
  });
}

test('aviso ajeno, institución no seguida y URL adulterada no muestran snapshot indebido', async ({ page }) => {
  await page.goto('/instituciones?rut=fixture-0&aviso=foreign-notice');
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toHaveCount(0);
  await expect(page.getByText(/aviso.*no está disponible|no se puede vincular/i)).toBeVisible();
  await page.goto('/instituciones?rut=not-followed&aviso=claim-1');
  await expect(page.getByText(/no está en tus seguimientos/i)).toBeVisible();
  await expect(page.getByText('Detalle exacto del reclamo recibido')).toHaveCount(0);
  await page.goto('/instituciones?rut=fixture-1&aviso=claim-1');
  await expect(page.getByText('Detalle exacto del reclamo recibido')).toHaveCount(0);
});

test('plan básico conserva restricción del detalle de reclamos', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('scenario', 'basic'));
  await page.goto('/instituciones?rut=fixture-0');
  await expect(page.getByText('El detalle de reclamos es parte de Experto Pro.')).toBeVisible();
  await expect(page.getByText('Reclamante de fixture', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Noticia reciente fixture-0', { exact: true })).toBeVisible();
});

test('móvil 360: campanita y ficha sin desbordamiento horizontal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/instituciones');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  const popover = await page.getByRole('dialog').boundingBox();
  expect(popover?.x).toBeGreaterThanOrEqual(0);
  expect((popover?.x || 0) + (popover?.width || 0)).toBeLessThanOrEqual(360);
  await page.getByRole('link', { name: /Reclamo por no pago/ }).click();
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toContainText('Detalle exacto del reclamo recibido');
  await expect(page.getByRole('region', { name: 'Evento del aviso' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('institution-mobile.png'), fullPage: true });
});
