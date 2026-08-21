import { test, expect } from "@playwright/test";

// PERSONA: Jefe de productos / PM. Administra el catálogo: productos, códigos,
// precios, fotos, y mantiene el inventario completo para PDFs y matches.
test.describe("Jefe de productos / inventario", () => {
  test("el inventario carga (tabla o estado vacío), sin error", async ({ page }) => {
    await page.goto("/inventario");
    await expect(page).toHaveURL(/inventario/);
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
    // Hay tabla de productos o un vacío que invita a cargar.
    const tabla = page.locator("table");
    const vacio = page.getByText(/sin productos|carga|importar/i).first();
    await expect(tabla.or(vacio)).toBeVisible();
  });

  test("existe el filtro/indicador de productos incompletos", async ({ page }) => {
    await page.goto("/inventario");
    await expect(page.getByText(/incompleto/i).first()).toBeVisible();
  });

  test("hay acción para enriquecer/agregar productos", async ({ page }) => {
    await page.goto("/inventario");
    await expect(
      page.getByRole("button", { name: /enriquecer|agregar|importar|nuevo producto/i }).first()
    ).toBeVisible();
  });
});
