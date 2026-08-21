import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

// Inicia sesión con la cuenta de prueba (E2E_EMAIL / E2E_PASSWORD) y guarda el
// estado de sesión para reutilizarlo en las personas autenticadas. La cuenta
// debe existir y, para cubrir todas las pantallas, tener rol admin.
setup("autenticar cuenta de prueba", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Faltan E2E_EMAIL / E2E_PASSWORD. Crea una cuenta de prueba (admin) y expórtalas antes de correr el E2E."
    );
  }

  await page.goto("/auth");
  // Pestaña "Iniciar Sesión" (es la default, pero la fijamos por robustez).
  await page.getByRole("tab", { name: /iniciar sesión/i }).click();

  await page.getByPlaceholder("tu@email.com").first().fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^iniciar sesión$/i }).click();

  // Tras autenticar, la app navega fuera de /auth (a dashboard/onboarding).
  await expect(page).not.toHaveURL(/\/auth\b/, { timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});
