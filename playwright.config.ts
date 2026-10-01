import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = process.env.E2E_PORT ?? '5345';
const slowMo = process.env.PLAYWRIGHT_SLOW_MO
  ? Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO, 10)
  : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['./e2e/reporters/audit-reporter.ts']],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    locale: 'ar-IQ',
    viewport: { width: 1400, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(slowMo != null && !Number.isNaN(slowMo)
      ? { launchOptions: { slowMo } }
      : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx server.ts',
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: E2E_PORT,
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: `http://127.0.0.1:${E2E_PORT},http://localhost:${E2E_PORT},http://localhost:5173,http://127.0.0.1:5173`,
      ENABLE_MOCK_AUTH: 'false',
    },
  },
});
