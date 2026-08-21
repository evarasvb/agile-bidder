import { defineConfig, devices } from "@playwright/test";

// E2E por personas para agile-bidder (FirmaVB).
// Requiere red hacia la preview de Vercel + Supabase (NO corre en el sandbox de
// Claude, cuya política de red bloquea esos hosts). Correr en CI o local.
//
// Variables de entorno:
//   E2E_BASE_URL   URL a testear (default: preview del branch)
//   E2E_EMAIL      cuenta de prueba (admin) para las personas autenticadas
//   E2E_PASSWORD   contraseña de esa cuenta
//   PW_CHROMIUM    ruta a un Chromium ya instalado (opcional)
const BASE_URL =
  process.env.E2E_BASE_URL ||
  "https://agile-bidder-git-claude-firmavb-cl-improvements-7pokzz-vamosle.vercel.app";

const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    // Login una vez y guarda la sesión para las personas autenticadas.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // Visita: sin sesión (usuario nuevo / prospecto).
    {
      name: "visita",
      testMatch: /visita\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], executablePath, storageState: undefined },
    },

    // Personas autenticadas: reutilizan la sesión del setup.
    ...["gerente", "supervisor", "jefe-producto", "vendedor"].map((name) => ({
      name,
      testMatch: new RegExp(`${name}\\.spec\\.ts`),
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        executablePath,
        storageState: "e2e/.auth/user.json",
      },
    })),
  ],
});
