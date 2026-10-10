import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  use: {baseURL: 'http://127.0.0.1:3100', headless: true, trace: 'retain-on-failure'},
  webServer: {command: 'node server/index.js', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, timeout: 30000, env: {PORT:'3100', DB_PATH: './data/e2e.sqlite', NODE_ENV:'test'}}
});
