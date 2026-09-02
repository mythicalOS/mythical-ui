// @ts-check
/* Strict-CSP contract: default-src 'none'; script-src 'self'; style-src 'self'
   (no 'unsafe-inline' for styles). The component must still render and submit —
   its styles arrive via adoptedStyleSheets (CSP-exempt), never an inline <style>
   HTML sink, and the tokens.css <link> is 'self' so it is allowed.

   Expected noise that is NOT a failure: font-src violations (tokens.css
   @font-face) — default-src 'none' blocks font fetches; the component does not
   depend on them. What must NOT happen: a style-src violation blocking the
   component's own styles, or the component failing to upgrade. */
import { test, expect } from '@playwright/test';

const FIXTURE = '/mythical-ui/packages/ui-core/test/select/csp-fixture.html';

test('strict CSP without style-src unsafe-inline is not fatal to the component', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (m) => consoleMessages.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(e.effectiveDirective || e.violatedDirective);
    });
  });

  await page.goto(FIXTURE);

  // 1. the component upgrades (script-src 'self' let it load and run)
  await page.waitForFunction(() => {
    const el = document.getElementById('csp');
    return !!(el && el.shadowRoot);
  });

  // 2. shadow styles applied via adoptedStyleSheets — not blocked by style-src
  const m = await page.evaluate(() => {
    const el = document.getElementById('csp');
    const btn = el.shadowRoot.querySelector('button');
    return {
      height: getComputedStyle(btn).height,
      adopted: el.shadowRoot.adoptedStyleSheets.length,
      inlineStyleTags: el.shadowRoot.querySelectorAll('style').length,
    };
  });
  expect(m.height).toBe('34px');
  expect(m.adopted).toBeGreaterThan(0);
  expect(m.inlineStyleTags).toBe(0); // no fallback <style> needed on these engines

  // 3. the value still submits
  const v = await page.evaluate(() => {
    const fd = new FormData(document.getElementById('form'));
    return fd.get('csp');
  });
  expect(v).toBe('a');

  // 4. no style-src violation hit the component (font-src noise is expected)
  const styleViolations = await page.evaluate(() =>
    (window.__cspViolations ?? []).filter((d) => String(d).startsWith('style-src')));
  expect(styleViolations).toEqual([]);
  expect(consoleMessages.filter((t) => /style-src|inline style/i.test(t))).toEqual([]);
  expect(pageErrors).toEqual([]);
});
