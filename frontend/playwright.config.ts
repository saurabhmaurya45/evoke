import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks against the production build (`npm run build` first).
 * Production is Netlify serving the prerendered files, so the tests run
 * against a static server that applies netlify.toml's rules — not the Node
 * SSR server. Playwright starts it for the run and stops it afterwards.
 */
const PORT = 4321;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'node e2e/netlify-static-server.mjs',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
