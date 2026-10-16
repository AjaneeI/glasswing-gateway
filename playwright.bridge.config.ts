import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testDir: './tests/gateway-ui',
  timeout: 120_000,
  use: { ...base.use, baseURL: undefined },
  outputDir: 'test-results/gateway-ui',
});
