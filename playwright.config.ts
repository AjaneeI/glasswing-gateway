import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const localChromium = join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: process.env.GATEWAY_TEST_URL || 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: existsSync(localChromium)
      ? { executablePath: localChromium, args: ['--no-sandbox'] }
      : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
