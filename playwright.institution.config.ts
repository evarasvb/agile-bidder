import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'institution-following.spec.ts',
  outputDir: 'test-results/institution-following', reporter: 'list',
  timeout: 60000, fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4189', headless: true, screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined },
  webServer: { command: 'npx vite --config e2e/institution-harness/vite.config.ts', url: 'http://127.0.0.1:4189', reuseExistingServer: false },
});
