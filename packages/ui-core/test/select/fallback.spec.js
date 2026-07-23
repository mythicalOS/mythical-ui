// @ts-check
/* No-ElementInternals fallback contract: on engines without attachInternals the
   module must NOT attempt the shadow component. Instead:
     - pure-tag instances synthesize a working native <select> (name, form,
       optgroups, [selected], disabled, required carried; the value attribute
       honored only when an option matches; non-option children preserved);
     - progressive instances keep their wrapped native select visible and named;
     - a FOUC guard style hides the raw option tags until synthesis runs.
   Simulated by deleting HTMLElement.prototype.attachInternals before any page
   script runs. */
import { test, expect } from '@playwright/test';

const FIXTURE = '/mythical-ui/packages/ui-core/test/select/fixture.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete HTMLElement.prototype.attachInternals;
  });
  await page.goto(FIXTURE);
  await page.waitForLoadState('load'); // synthesis is deferred to DOMContentLoaded
});

test('pure-tag instance synthesizes a working native select', async ({ page }) => {
  const r = await page.evaluate(() => {
    const host = document.getElementById('pure');
    const sel = host.querySelector('select');
    if (!sel) return null;
    return {
      internalsGone: !('attachInternals' in HTMLElement.prototype), // simulation sanity
      noShadow: host.shadowRoot === null,
      name: sel.name,
      value: sel.value,
      groups: [...sel.querySelectorAll('optgroup')].map((g) => g.label),
      options: [...sel.options].map((o) => ({ value: o.value, text: o.text, disabled: o.disabled })),
      carriersRemoved: host.querySelectorAll('mythical-option, mythical-optgroup').length === 0,
      notePreserved: host.querySelector('#pure-note')?.textContent ?? null,
      submitted: new FormData(document.getElementById('form')).get('pure'),
    };
  });
  expect(r).not.toBeNull();
  expect(r.internalsGone).toBe(true);
  expect(r.noShadow).toBe(true);
  expect(r.name).toBe('pure');
  expect(r.value).toBe('fresh'); // [selected] carried
  expect(r.groups).toEqual(['Cross-model', 'Local']);
  expect(r.options.map((o) => o.value)).toEqual(['codex', 'gemini', 'fresh', 'off']);
  expect(r.options[1].disabled).toBe(true);
  expect(r.options.map((o) => o.text)).toEqual(
    ['codex cross-model', 'gemini flash', 'fresh context', 'off']);
  expect(r.carriersRemoved).toBe(true);
  expect(r.notePreserved).toBe('unrelated child'); // non-option children preserved
  expect(r.submitted).toBe('fresh'); // the form keeps working
});

test('required and disabled attributes carry to the synthesized select', async ({ page }) => {
  const r = await page.evaluate(() => ({
    required: document.getElementById('required-sel').querySelector('select')?.required ?? null,
    requiredValue: document.getElementById('required-sel').querySelector('select')?.value ?? null,
    disabled: document.getElementById('disabled-sel').querySelector('select')?.disabled ?? null,
  }));
  expect(r.required).toBe(true);
  expect(r.requiredValue).toBe(''); // placeholder first option is the default
  expect(r.disabled).toBe(true);
});

test('form attribute: carried to the synthesized select — external form association works', async ({ page }) => {
  const r = await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'xfb';
    document.body.append(form);
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'xw');
    el.setAttribute('form', 'xfb'); // associated with #xfb from OUTSIDE it
    for (const [v, t, s] of [['a', 'Aye', false], ['b', 'Bee', true]]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      if (s) o.setAttribute('selected', '');
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el); // post-load connect → immediate synthesis
    const sel = el.querySelector('select');
    return {
      formAttr: sel?.getAttribute('form') ?? null,
      associated: sel?.form === form,
      entry: new FormData(form).get('xw'),
    };
  });
  expect(r).toEqual({ formAttr: 'xfb', associated: true, entry: 'b' });
});

test('progressive instance keeps its native select visible and named', async ({ page }) => {
  const r = await page.evaluate(() => {
    const sel = document.getElementById('wrapped').querySelector('select');
    return {
      name: sel.name,
      display: getComputedStyle(sel).display,
      ariaHidden: sel.getAttribute('aria-hidden'),
      value: sel.value,
      submitted: new FormData(document.getElementById('form')).get('wrapped'),
    };
  });
  expect(r.name).toBe('wrapped');
  expect(r.display).not.toBe('none');
  expect(r.ariaHidden).toBeNull();
  expect(r.value).toBe('p1');
  expect(r.submitted).toBe('p1');
});

test('value attribute: honored when an option matches, stale value ignored', async ({ page }) => {
  const r = await page.evaluate(() => {
    const make = (value) => {
      const el = document.createElement('mythical-select');
      el.setAttribute('name', `dyn-${value}`);
      el.setAttribute('value', value);
      for (const [v, t, s] of [['x', 'Xray', true], ['y', 'Yankee', false]]) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = t;
        if (s) o.setAttribute('selected', '');
        el.append(o);
      }
      document.body.append(el); // post-load connect → immediate synthesis
      return el.querySelector('select')?.value ?? null;
    };
    return { stale: make('nope'), matching: make('y') };
  });
  expect(r.stale).toBe('x'); // stale value attr must not clear the [selected] default
  expect(r.matching).toBe('y'); // matching value attr wins
});

test('canonicalization: implicit value collapses whitespace and label overrides display (parity with the full component)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'canon');
    const a = document.createElement('mythical-option');
    a.textContent = '  alpha \n\t  row  '; // no value attribute
    const b = document.createElement('mythical-option');
    b.setAttribute('label', 'Pretty');
    b.textContent = 'ugly value';
    el.append(a, b);
    document.body.append(el); // post-load connect → immediate synthesis
    return [...el.querySelector('select').options]
      .map((o) => ({ value: o.value, text: o.text, label: o.label }));
  });
  expect(r).toEqual([
    { value: 'alpha row', text: 'alpha row', label: 'alpha row' }, // strip-and-collapse
    { value: 'ugly value', text: 'ugly value', label: 'Pretty' }, // label = display only
  ]);
});

test('canonicalization: NBSP survives in the synthesized select — only ASCII whitespace collapses', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'nbspfb');
    const o = document.createElement('mythical-option');
    o.textContent = '  10\u00a0GB \n\t '; // ASCII whitespace around, NBSP inside
    el.append(o);
    document.body.append(el); // post-load connect → immediate synthesis
    const opt = el.querySelector('select').options[0];
    return { value: opt.value, text: opt.text };
  });
  const NB = '10\u00a0GB'; // native canonicalization preserves the NBSP
  expect(r).toEqual({ value: NB, text: NB });
});

test('the FOUC guard style is installed', async ({ page }) => {
  const guard = await page.evaluate(() =>
    [...document.querySelectorAll('style')].some((s) =>
      s.textContent.includes('mythical-select mythical-option') &&
      s.textContent.includes('display:none')));
  expect(guard).toBe(true);
});
