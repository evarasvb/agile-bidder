import { test, expect } from "@playwright/test";

// PERSONA: Postulador / vendedor. Encuentra oportunidades que hacen match,
// prepara la oferta + ficha técnica, y las mueve por el pipeline.
test.describe("Vendedor / postulador", () => {
  test("la bandeja de oportunidades carga con chips de tipo", async ({ page }) => {
    await page.goto("/oportunidades");
    await expect(page).toHaveURL(/oportunidades/);
    await expect(page.getByRole("button", { name: /^todas$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /compras ágiles/i }).first()).toBeVisible();
  });

  test("Compras Ágiles carga y permite abrir una", async ({ page }) => {
    await page.goto("/compras-agiles");
    await expect(page).toHaveURL(/compras-agiles/);
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
  });

  test("el detalle de una compra ágil ofrece Generar propuesta (no es callejón sin salida)", async ({ page }) => {
    // Abrimos una compra ágil desde la bandeja. Si no hay ninguna visible,
    // el test se marca como skip (depende de que haya stock activo).
    await page.goto("/compras-agiles");
    const primera = page.locator("table tbody tr").first();
    const hayFilas = await primera.count();
    test.skip(hayFilas === 0, "Sin compras ágiles activas para abrir en este momento");
    await primera.click();
    await expect(
      page.getByRole("button", { name: /generar propuesta/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("el pipeline (Postulaciones) carga", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/pipeline/);
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
  });
});
