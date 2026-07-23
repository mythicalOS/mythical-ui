// @ts-check
// Cross-engine contract suite for mythical-select. The fixtures are served over
// HTTP (not file://) so the strict-CSP fixture's 'self' source keeps meaning:
// a tiny python3 static server rooted high enough (the umbrella
// checkout) to reach both this package's fixtures/component AND the sibling
// canonical mythical-design/tokens.css — the same sibling-checkout resolution
// test/css.test.ts already relies on for its filesystem read of tokens.css.
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url)); // packages/ui-core
const ROOT = path.join(PACKAGE_ROOT, '..', '..', '..'); // umbrella (server root)
const FIXTURE_BASE = '/mythical-ui/packages/ui-core/test/select';

export default defineConfig({
  testDir: './test/select',
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: `http://localhost:4173${FIXTURE_BASE}/fixture.html`,
    cwd: ROOT,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
