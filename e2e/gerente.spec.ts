import { test, expect } from "@playwright/test";

// PERSONA: Gerente. Quiere una lectura de 30 segundos: cómo vamos, dónde está
// el dinero, qué necesita atención — sin escarbar.
test.describe("Gerente / dashboard", () => {
  test("el dashboard carga con el resumen ejecutivo y KPIs (datos reales)", async ({ page }) => {
    await page.goto("/dashboard");
    // No hay pantalla de error.
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
    // KPIs de cabecera reetiquetados a alcance de mercado.
    await expect(page.getByText(/oportunidades activas/i).first()).toBeVisible();
    await expect(page.getByText(/tasa de éxito/i).first()).toBeVisible();
  });

  test("Cierres Próximos (la señal de urgencia) está presente y no roto", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/cierres próximos/i).first()).toBeVisible();
    // El widget (antes roto por columna inexistente) no debe mostrar error.
    await expect(page.getByText(/error/i)).toHaveCount(0);
  });

  test("puede entrar a Reportes", async ({ page }) => {
    await page.goto("/reportes");
    await expect(page).toHaveURL(/\/reportes/);
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
  });
});
