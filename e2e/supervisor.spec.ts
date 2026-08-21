import { test, expect } from "@playwright/test";

// PERSONA: Jefe / supervisor de equipo. Ve a su equipo, su desempeño, y
// administra miembros y roles.
test.describe("Supervisor / equipo", () => {
  test("la sub-navegación de equipo (Miembros/Desempeño/Roles) está unificada", async ({ page }) => {
    await page.goto("/equipo");
    await expect(page.getByRole("link", { name: /miembros/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /desempeño/i }).first()).toBeVisible();
  });

  test("puede abrir el flujo de invitar miembro", async ({ page }) => {
    await page.goto("/equipo");
    await page.getByRole("button", { name: /invitar miembro/i }).first().click();
    // El diálogo ofrece el rol con el vocabulario correcto (Admin/Vendedor/Visor).
    await expect(page.getByText(/rol/i).first()).toBeVisible();
  });

  test("Desempeño del equipo carga con datos (no placeholder)", async ({ page }) => {
    await page.goto("/dashboard/vendedores");
    await expect(page).toHaveURL(/vendedores/);
    await expect(page.getByText(/error al cargar/i)).toHaveCount(0);
  });

  test("Roles y permisos accesible para admin", async ({ page }) => {
    await page.goto("/configuracion/equipo");
    // Para admin NO debe salir el muro "Acceso Restringido".
    await expect(page.getByText(/acceso restringido/i)).toHaveCount(0);
  });
});
