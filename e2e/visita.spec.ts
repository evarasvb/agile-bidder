import { test, expect } from "@playwright/test";

// PERSONA: Visita / usuario nuevo (sin sesión). Aterriza frío, prueba la
// búsqueda, evalúa el valor y decide registrarse.
test.describe("Visita / usuario nuevo", () => {
  test("la landing carga y comunica el valor", async ({ page }) => {
    await page.goto("/");
    // Marca de FirmaVB y un CTA de registro visibles.
    await expect(page.getByRole("link", { name: /comenzar|registrar|gratis/i }).first()).toBeVisible();
  });

  test("la búsqueda del teaser hace algo (no es un botón muerto)", async ({ page }) => {
    await page.goto("/");
    const buscador = page.getByPlaceholder(/busca|producto|rubro|licitaci/i).first();
    await buscador.fill("sillas");
    await page.getByRole("button", { name: /analizar|buscar/i }).first().click();
    // El teaser de resultados aparece (o al menos algún panel de resultados).
    await expect(page.getByText(/resultado|coinciden|licitaci|compras ágiles/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("el CTA de registro lleva a la pestaña de signup", async ({ page }) => {
    await page.goto("/auth?tab=signup");
    await expect(page.getByRole("tab", { name: /registrarse/i })).toBeVisible();
    await expect(page.getByPlaceholder(/mínimo 6 caracteres/i)).toBeVisible();
  });

  test("el contacto de soporte es contacto@firmavb.cl (no soporte@)", async ({ page }) => {
    await page.goto("/");
    const body = await page.content();
    expect(body).toContain("contacto@firmavb.cl");
    expect(body).not.toContain("soporte@firmavb.cl");
  });
});
