// @ts-check
/* Native-parity contract for <mythical-select> v3 (APG select-only combobox).
   Every test in this file must pass unchanged on chromium, firefox AND webkit —
   this is the executable form of the "native-parity surface" documented in the
   component header (see SOURCE_REVIEW.md, finding "native-parity behavior has
   no executable contract").

   Fixture map (test/select/fixture.html):
     #pure         pure tags, optgroups, o1 disabled, o2 [selected]  (label "Lane")
                   options: 0 codex · 1 gemini(disabled) · 2 fresh(selected) · 3 off
     #wrapped      progressive, wraps native <select name="wrapped">, p1 [selected]
     #disabled-sel disabled instance
     #chip         variant="chip"
     #required-sel required + value="" placeholder first option */
import { test, expect } from '@playwright/test';

const FIXTURE = '/mythical-ui/packages/ui-core/test/select/fixture.html';

/** Count input/change events from mythical-selects at the document (they must
 *  bubble + be composed to get there). Call before the interaction under test. */
async function armEvents(page) {
  await page.evaluate(() => {
    window.__ev = [];
    for (const t of ['input', 'change']) {
      document.addEventListener(t, (e) => {
        const el = /** @type {Element} */ (e.target);
        if (el && el.localName === 'mythical-select') {
          window.__ev.push({ type: t, id: el.id, bubbles: e.bubbles, composed: e.composed });
        }
      });
    }
  });
}
const eventsFor = (page, id) =>
  page.evaluate((wanted) => (window.__ev ?? []).filter((e) => e.id === wanted), id);

/** Read facts about one instance from inside its shadow root. */
const inspect = (page, id) =>
  page.evaluate((hostId) => {
    const el = document.getElementById(hostId);
    const r = el.shadowRoot;
    const btn = r.querySelector('button');
    return {
      value: el.value,
      selectedIndex: el.selectedIndex,
      label: r.querySelector('#label').textContent,
      expanded: btn.getAttribute('aria-expanded'),
      activeDesc: btn.getAttribute('aria-activedescendant'),
      popHidden: r.querySelector('#pop').hidden,
    };
  }, id);

test.beforeEach(async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!customElements.get('mythical-select'));
});

/* ---------------------------------------------------------------- sizing */

test('sizing: trigger is 34px tall with a 6px radius', async ({ page }) => {
  const m = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('pure').shadowRoot.querySelector('button'));
    return { h: cs.height, r: cs.borderTopLeftRadius };
  });
  expect(m).toEqual({ h: '34px', r: '6px' });
});

test('sizing: chip variant trigger is 28px tall with a 6px radius', async ({ page }) => {
  const m = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('chip').shadowRoot.querySelector('button'));
    return { h: cs.height, r: cs.borderTopLeftRadius };
  });
  expect(m).toEqual({ h: '28px', r: '6px' });
});

/* ------------------------------------------------------------------ ARIA */

test('ARIA: trigger is a combobox controlling the listbox; activedescendant only while open', async ({ page }) => {
  const btn = page.locator('#pure button');
  await expect(btn).toHaveAttribute('role', 'combobox');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).not.toHaveAttribute('aria-activedescendant');

  const rel = await page.evaluate(() => {
    const r = document.getElementById('pure').shadowRoot;
    const pop = r.querySelector('[role="listbox"]');
    return {
      controls: r.querySelector('button').getAttribute('aria-controls'),
      popId: pop ? pop.id : null,
      optionRoles: [...pop.querySelectorAll('.opt')].map((n) => n.getAttribute('role')),
      selectedCount: pop.querySelectorAll('[role="option"][aria-selected="true"]').length,
    };
  });
  expect(rel.popId).not.toBeNull();
  expect(rel.controls).toBe(rel.popId);
  expect(rel.optionRoles).toEqual(['option', 'option', 'option', 'option']);
  expect(rel.selectedCount).toBe(1);

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o2'); // follows the selection
  const activeRole = await page.evaluate(() => {
    const r = document.getElementById('pure').shadowRoot;
    const id = r.querySelector('button').getAttribute('aria-activedescendant');
    return r.getElementById(id)?.getAttribute('role') ?? null;
  });
  expect(activeRole).toBe('option');

  await btn.click(); // toggle closed
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).not.toHaveAttribute('aria-activedescendant');
});

test('ARIA: labeled groups are role=group containers labelled by their heading', async ({ page }) => {
  const r = await page.evaluate(() => {
    const root = document.getElementById('pure').shadowRoot;
    const pop = root.querySelector('#pop');
    return {
      directChildRoles: [...pop.children].map((n) => n.getAttribute('role')),
      groups: [...pop.querySelectorAll('[role="group"]')].map((g) => {
        const heading = root.getElementById(g.getAttribute('aria-labelledby'));
        return {
          label: heading ? heading.textContent : null, // aria-labelledby resolves
          headingInGroup: heading ? g.contains(heading) : false,
          headingRole: heading ? heading.getAttribute('role') : 'missing',
          optionIds: [...g.querySelectorAll('.opt')].map((o) => o.id),
        };
      }),
    };
  });
  expect(r.directChildRoles).toEqual(['group', 'group']); // #pure: all options grouped
  expect(r.groups).toEqual([
    { label: 'Cross-model', headingInGroup: true, headingRole: null, optionIds: ['o0', 'o1'] },
    { label: 'Local', headingInGroup: true, headingRole: null, optionIds: ['o2', 'o3'] },
  ]);
});

test('ARIA: two ADJACENT groups with identical labels stay two role=group containers', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'samegrp';
    el.setAttribute('name', 'samegrp');
    for (const opts of [[['a', 'Aye']], [['b', 'Bee']]]) {
      const g = document.createElement('mythical-optgroup');
      g.setAttribute('label', 'Same'); // identical label TEXT on both groups
      for (const [v, t] of opts) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = t;
        g.append(o);
      }
      el.append(g);
    }
    document.body.append(el);
  });
  const r = await page.evaluate(() => {
    const root = document.getElementById('samegrp').shadowRoot;
    const pop = root.querySelector('#pop');
    return {
      roles: [...pop.children].map((n) => n.getAttribute('role')),
      groups: [...pop.querySelectorAll('[role="group"]')].map((g) => ({
        label: root.getElementById(g.getAttribute('aria-labelledby'))?.textContent ?? null,
        optionIds: [...g.querySelectorAll('.opt')].map((o) => o.id),
      })),
    };
  });
  // boundaries key on source-ELEMENT identity, not label text — two containers
  expect(r.roles).toEqual(['group', 'group']);
  expect(r.groups).toEqual([
    { label: 'Same', optionIds: ['o0'] },
    { label: 'Same', optionIds: ['o1'] },
  ]);
});

test('ARIA: accessible name mirrors the external <label for>', async ({ page }) => {
  await expect(page.getByRole('combobox', { name: 'Lane', exact: true })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Priority', exact: true })).toHaveCount(1);
  const al = await page.evaluate(() =>
    document.getElementById('pure').shadowRoot.querySelector('button').getAttribute('aria-label'));
  expect(al).toBe('Lane');
});

test('ARIA: a wrapping <label> mirrors only its OWN text; refreshed on focus', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'wl';
    el.setAttribute('name', 'wl');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    const label = document.createElement('label');
    label.id = 'wl-label';
    label.append('Mode ', el); // wrapping label: the host sits INSIDE the label
    document.body.append(label);
  });
  // the host's own subtree (option text) must not leak into the accessible name
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('wl').shadowRoot.querySelector('button').getAttribute('aria-label'),
  )).toBe('Mode');
  // staleness: label text edited after adoption → recomputed when focus arrives
  await page.evaluate(() => {
    document.getElementById('wl-label').firstChild.textContent = 'Updated mode ';
    document.getElementById('wl').focus();
  });
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('wl').shadowRoot.querySelector('button').getAttribute('aria-label'),
  )).toBe('Updated mode');

  // ancestor-span shape: text at ANY depth around the host is kept — only the
  // host subtree is excluded (whitespace-normalized)
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'wl2';
    el.setAttribute('name', 'wl2');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'alpha row';
    el.append(o);
    const span = document.createElement('span');
    span.append('Mode ', el, ' required');
    const label = document.createElement('label');
    label.append(span); // the host sits inside a SPAN inside the label
    document.body.append(label);
  });
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('wl2').shadowRoot.querySelector('button').getAttribute('aria-label'),
  )).toBe('Mode required');
});

test('ARIA: label mirror skips aria-hidden/[hidden] subtrees and uses <img> alt (accname subset)', async ({ page }) => {
  await page.evaluate(() => {
    const mk = (id) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', id);
      const o = document.createElement('mythical-option');
      o.setAttribute('value', 'a');
      o.textContent = 'alpha row';
      el.append(o);
      return el;
    };
    // (1) decorative star + hidden helper text: both subtrees are skipped
    const l1 = document.createElement('label');
    l1.setAttribute('for', 'lh1');
    const star = document.createElement('span');
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '*';
    const helper = document.createElement('span');
    helper.setAttribute('hidden', '');
    helper.textContent = 'hidden helper';
    l1.append('Mode ', star, helper);
    document.body.append(l1, mk('lh1'));
    // (2) an <img> contributes its alt text instead of being descended
    const l2 = document.createElement('label');
    l2.setAttribute('for', 'lh2');
    const img = document.createElement('img');
    img.setAttribute('alt', 'Mode icon');
    img.setAttribute('width', '1');
    img.setAttribute('height', '1');
    l2.append(img, ' lane');
    document.body.append(l2, mk('lh2'));
  });
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('lh1').shadowRoot.querySelector('button').getAttribute('aria-label'),
  )).toBe('Mode');
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('lh2').shadowRoot.querySelector('button').getAttribute('aria-label'),
  )).toBe('Mode icon lane');
});

test('ARIA: host aria-label names the trigger (host and wrapped-native tiers)', async ({ page }) => {
  await page.evaluate(() => {
    // host-level aria-label — no <label> anywhere
    const el = document.createElement('mythical-select');
    el.id = 'an1';
    el.setAttribute('name', 'an1');
    el.setAttribute('aria-label', 'Lane picker');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'alpha row';
    el.append(o);
    document.body.append(el);
    // aria-label on the WRAPPED native reaches the trigger too (tier 3)
    const host = document.createElement('mythical-select');
    host.id = 'an1w';
    const sel = document.createElement('select');
    sel.name = 'an1w';
    sel.setAttribute('aria-label', 'Wrapped lane');
    const no = document.createElement('option');
    no.value = 'x';
    no.text = 'x';
    sel.append(no);
    host.append(sel);
    document.body.append(host);
  });
  const name = (id) => page.evaluate((hostId) =>
    document.getElementById(hostId).shadowRoot.querySelector('button').getAttribute('aria-label'), id);
  await expect.poll(() => name('an1')).toBe('Lane picker');
  await expect(page.getByRole('combobox', { name: 'Lane picker', exact: true })).toHaveCount(1);
  await expect.poll(() => name('an1w')).toBe('Wrapped lane');
});

test('ARIA: host aria-labelledby resolves ids in the host root node (outranks aria-label)', async ({ page }) => {
  await page.evaluate(() => {
    const h1 = document.createElement('span');
    h1.id = 'alb-a';
    h1.textContent = 'Deploy';
    const h2 = document.createElement('span');
    h2.id = 'alb-b';
    h2.textContent = '  lane  '; // whitespace-normalized through the accname walk
    const el = document.createElement('mythical-select');
    el.id = 'an2';
    el.setAttribute('name', 'an2');
    el.setAttribute('aria-labelledby', 'alb-a alb-b');
    el.setAttribute('aria-label', 'Ignored'); // labelledby wins within the host tier
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'alpha row';
    el.append(o);
    document.body.append(h1, h2, el);
    // …and aria-labelledby on the WRAPPED native resolves the same way (tier 3)
    const h3 = document.createElement('span');
    h3.id = 'alb-c';
    h3.textContent = 'Country of origin';
    const host = document.createElement('mythical-select');
    host.id = 'an2w';
    const sel = document.createElement('select');
    sel.name = 'an2w';
    sel.setAttribute('aria-labelledby', 'alb-c');
    const no = document.createElement('option');
    no.value = 'x';
    no.text = 'x';
    sel.append(no);
    host.append(sel);
    document.body.append(h3, host);
  });
  const name = (id) => page.evaluate((hostId) =>
    document.getElementById(hostId).shadowRoot.querySelector('button').getAttribute('aria-label'), id);
  await expect.poll(() => name('an2')).toBe('Deploy lane');
  await expect(page.getByRole('combobox', { name: 'Deploy lane', exact: true })).toHaveCount(1);
  await expect.poll(() => name('an2w')).toBe('Country of origin');
});

test('ARIA: a dynamic aria-label change re-mirrors onto the trigger', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'an3';
    el.setAttribute('name', 'an3');
    el.setAttribute('aria-label', 'Before');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'alpha row';
    el.append(o);
    document.body.append(el);
  });
  const name = () => page.evaluate(() =>
    document.getElementById('an3').shadowRoot.querySelector('button').getAttribute('aria-label'));
  await expect.poll(name).toBe('Before');
  await page.evaluate(() => document.getElementById('an3').setAttribute('aria-label', 'After'));
  await expect.poll(name).toBe('After');
  // no other naming source: removing the attribute un-names the trigger
  await page.evaluate(() => document.getElementById('an3').removeAttribute('aria-label'));
  await expect.poll(name).toBe(null);
});

test('ARIA: aria-label OUTRANKS the associated <label> text; clearing it falls back', async ({ page }) => {
  const name = () => page.evaluate(() =>
    document.getElementById('pure').shadowRoot.querySelector('button').getAttribute('aria-label'));
  await expect.poll(name).toBe('Lane'); // the <label for> mirror (fixture)
  await page.evaluate(() => document.getElementById('pure').setAttribute('aria-label', 'Lane (compact)'));
  await expect.poll(name).toBe('Lane (compact)'); // explicit attribute wins
  await expect(page.getByRole('combobox', { name: 'Lane (compact)', exact: true })).toHaveCount(1);
  await page.evaluate(() => document.getElementById('pure').removeAttribute('aria-label'));
  await expect.poll(name).toBe('Lane'); // label mirror returns
});

/* ----------------------------------------------------- initial selection */

test('initial selection: [selected] honored in both authoring modes', async ({ page }) => {
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2, label: 'fresh context' });
  expect(await inspect(page, 'wrapped')).toMatchObject({ value: 'p1', selectedIndex: 1, label: 'P1 next' });
});

test('initial selection: with multiple [selected] options the LAST one wins (native parity)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'twosel';
    el.setAttribute('name', 'twosel');
    for (const [v, t, s] of [['a', 'Aye', true], ['b', 'Bee', false], ['c', 'Sea', true]]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      if (s) o.setAttribute('selected', '');
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    return { value: el.value, selectedIndex: el.selectedIndex };
  });
  expect(r).toEqual({ value: 'c', selectedIndex: 2 }); // native resolves the LAST [selected]
});

test('initial selection: value attribute honored', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'dyn-value';
    el.setAttribute('name', 'dyn-value');
    el.setAttribute('value', 'b');
    for (const [v, t] of [['a', 'Aye'], ['b', 'Bee'], ['c', 'Sea']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    return { value: el.value, selectedIndex: el.selectedIndex };
  });
  expect(r).toEqual({ value: 'b', selectedIndex: 1 });
});

test('initial selection: value attribute survives an empty connect (register-before-markup)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // register-before-markup simulation: the element connects BEFORE its options
    // exist — the first adoption finds zero children and must NOT consume the
    // one-shot value-attribute path
    const el = document.createElement('mythical-select');
    el.id = 'late-opts';
    el.setAttribute('name', 'late-opts');
    el.setAttribute('value', 'b');
    document.body.append(el); // connect EMPTY
    const empty = { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
    for (const [v, t] of [['a', 'Aye'], ['b', 'Bee'], ['c', 'Sea']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o); // options stream in later (MutationObserver path)
    }
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return { empty, value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  expect(r.empty).toEqual({ value: '', selectedIndex: -1, length: 0 });
  expect(r).toMatchObject({ value: 'b', selectedIndex: 1, length: 3 });
});

test('initial selection: first option is the default', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    for (const v of ['one', 'two']) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
    return { value: el.value, selectedIndex: el.selectedIndex };
  });
  expect(r).toEqual({ value: 'one', selectedIndex: 0 });
  // required placeholder pattern: first option value="" is the default too
  expect(await inspect(page, 'required-sel')).toMatchObject({ value: '', selectedIndex: 0 });
});

test('disabled instance: trigger is disabled and never opens', async ({ page }) => {
  const btn = page.locator('#disabled-sel button');
  await expect(btn).toBeDisabled();
  await btn.click({ force: true }); // clicking a disabled trigger must be a no-op
  expect(await inspect(page, 'disabled-sel')).toMatchObject({ expanded: 'false', popHidden: true });
});

/* ------------------------------------------------------- mouse open/commit */

test('mouse: click opens, option click commits + closes, exactly one input+change at document', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  const pop = page.locator('#pure #pop');

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(pop).toBeVisible();

  await page.locator('#pure .opt[data-i="3"]').click(); // "off"
  await expect(pop).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'off', selectedIndex: 3, label: 'off' });

  const ev = await eventsFor(page, 'pure');
  expect(ev.map((e) => e.type)).toEqual(['input', 'change']); // one each, input first
  for (const e of ev) {
    expect(e.bubbles).toBe(true);
    expect(e.composed).toBe(true);
  }
});

test('focus: programmatic focus departure while open closes without committing (cancel path)', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at the selection (o2)
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown'); // move active to o3 — must NOT commit below
  await page.evaluate(() => document.getElementById('submit').focus()); // focus leaves the host
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#pure #pop')).toBeHidden();
  await expect(btn).not.toHaveAttribute('aria-activedescendant');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 }); // unchanged
  expect(await eventsFor(page, 'pure')).toEqual([]); // cancel, like outside-click
});

/* ---------------------------------------------------------------- keyboard */

test('keyboard: ArrowDown opens; Arrows/Home/End move active; disabled options skipped', async ({ page }) => {
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open — active follows the selection
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o2');
  await page.keyboard.press('ArrowDown');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o3');
  await page.keyboard.press('ArrowUp'); // back to 2
  await page.keyboard.press('ArrowUp'); // o1 is disabled → skip to 0
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
  await page.keyboard.press('End');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o3');
  await page.keyboard.press('Home');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
});

test('keyboard: Enter commits the active option', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o2
  await page.keyboard.press('ArrowDown'); // o3
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'off', selectedIndex: 3 });
  expect((await eventsFor(page, 'pure')).map((e) => e.type)).toEqual(['input', 'change']);
});

test('keyboard: Space commits the active option', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowUp'); // ArrowUp also opens when closed
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Home'); // o0
  await page.keyboard.press('Space');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'codex', selectedIndex: 0 });
  expect((await eventsFor(page, 'pure')).map((e) => e.type)).toEqual(['input', 'change']);
});

test('keyboard: Escape closes without committing', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o2
  await page.keyboard.press('ArrowDown'); // move active to o3
  await page.keyboard.press('Escape');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).not.toHaveAttribute('aria-activedescendant');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 });
  expect(await eventsFor(page, 'pure')).toEqual([]);
});

test('keyboard: Tab commits the active option, closes and moves focus on', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o2 (the selection)
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown'); // active → o3
  await page.keyboard.press('Tab'); // commits like Enter, but focus moves on
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'off', selectedIndex: 3, popHidden: true });
  expect((await eventsFor(page, 'pure')).map((e) => e.type)).toEqual(['input', 'change']);
  const stillFocused = await page.evaluate(() => document.activeElement === document.getElementById('pure'));
  expect(stillFocused).toBe(false); // no preventDefault — the Tab left the control
});

test('keyboard: closed Home/End open at the first/last enabled option, committing nothing', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('Home');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0'); // first enabled
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('End');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o3'); // last enabled
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 });
  expect(await eventsFor(page, 'pure')).toEqual([]); // nothing committed either way
});

test('keyboard: closed typeahead commits without opening', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('o'); // "off"
  expect(await inspect(page, 'pure')).toMatchObject({
    value: 'off', selectedIndex: 3, expanded: 'false', popHidden: true,
  });
  expect((await eventsFor(page, 'pure')).map((e) => e.type)).toEqual(['input', 'change']);
});

test('keyboard: open typeahead moves the active option without committing', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o2
  await page.keyboard.press('c'); // "codex cross-model"
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 });
  expect(await eventsFor(page, 'pure')).toEqual([]);
});

test('keyboard: PageUp/PageDown jump by 10 while open (clamped, disabled skipped); closed = no-op', async ({ page }) => {
  await armEvents(page);
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'long';
    el.setAttribute('name', 'long');
    for (let i = 0; i < 24; i++) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', `v${i}`);
      o.textContent = `option ${i}`;
      if (i === 12 || i === 23) o.setAttribute('disabled', ''); // mid-jump + last
      el.append(o);
    }
    document.body.append(el);
  });
  const btn = page.locator('#long button');
  await btn.focus();
  // CLOSED PageDown/PageUp do nothing — native parity (no open, no move, no commit)
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageUp');
  expect(await inspect(page, 'long')).toMatchObject({ expanded: 'false', popHidden: true, selectedIndex: 0 });
  // open at the selection, then page through
  await page.keyboard.press('ArrowDown');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
  await page.keyboard.press('PageDown'); // 10 enabled forward: 1..10
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o10');
  await page.keyboard.press('PageDown'); // skips disabled o12: 11, 13..21
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o21');
  await page.keyboard.press('PageDown'); // clamps at the LAST enabled (o23 disabled)
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o22');
  await page.keyboard.press('PageUp'); // 10 enabled back, skipping o12: 21..13, 11
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o11');
  await page.keyboard.press('PageUp'); // 10, 9..1
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o1');
  await page.keyboard.press('PageUp'); // clamps at the FIRST enabled
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
  expect(await inspect(page, 'long')).toMatchObject({ value: 'v0', selectedIndex: 0 }); // nothing committed
  expect(await eventsFor(page, 'long')).toEqual([]);
});

test('keyboard: single/repeated-character typeahead cycles among same-letter options while open', async ({ page }) => {
  await armEvents(page);
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'cyc';
    el.setAttribute('name', 'cyc');
    for (const v of ['ash', 'aspen', 'birch']) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
    // record every aria-activedescendant write page-side: the presses below stay
    // back-to-back (typeahead has a 600ms buffer window — no roundtrips between)
    const btn = el.shadowRoot.querySelector('button');
    window.__act = [];
    new MutationObserver(() => window.__act.push(btn.getAttribute('aria-activedescendant')))
      .observe(btn, { attributes: true, attributeFilter: ['aria-activedescendant'] });
  });
  const btn = page.locator('#cyc button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o0 ("ash" — the selection)
  await page.keyboard.press('a'); // single char searches PAST the active option → "aspen"
  await page.keyboard.press('a'); // "aa" → cycles on, wrapping past "birch" → "ash"
  await page.keyboard.press('a'); // "aaa" → "aspen" again
  await expect(btn).toHaveAttribute('aria-expanded', 'true'); // still open
  expect(await page.evaluate(() => window.__act)).toEqual(['o0', 'o1', 'o0', 'o1']);
  expect(await inspect(page, 'cyc')).toMatchObject({ value: 'ash', selectedIndex: 0 });
  expect(await eventsFor(page, 'cyc')).toEqual([]); // navigation only — no commits
});

test('keyboard: repeated-character typeahead cycles + commits while closed', async ({ page }) => {
  await armEvents(page);
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'cyc2';
    el.setAttribute('name', 'cyc2');
    for (const v of ['birch', 'ash', 'aspen']) { // selection starts on "birch"
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
    window.__vals = [];
    el.addEventListener('change', (e) => window.__vals.push(/** @type {any} */ (e.target).value));
  });
  await page.locator('#cyc2 button').focus();
  await page.keyboard.press('a'); // searches past "birch" (the selection) → commits "ash"
  await page.keyboard.press('a'); // "aa" → cycles on → commits "aspen"
  await page.keyboard.press('a'); // "aaa" → wraps (skipping "birch") → "ash" again
  expect(await page.evaluate(() => window.__vals)).toEqual(['ash', 'aspen', 'ash']);
  expect(await inspect(page, 'cyc2')).toMatchObject({
    value: 'ash', selectedIndex: 1, expanded: 'false', popHidden: true,
  });
  expect((await eventsFor(page, 'cyc2')).map((e) => e.type)).toEqual(
    ['input', 'change', 'input', 'change', 'input', 'change']);
});

test('keyboard: closed single-character typeahead searches from AFTER the selection (ash → aspen)', async ({ page }) => {
  await armEvents(page);
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'single';
    el.setAttribute('name', 'single');
    for (const v of ['ash', 'aspen', 'birch']) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el); // "ash" selected (first-option default)
  });
  await page.locator('#single button').focus();
  await page.keyboard.press('a'); // one char: search starts PAST "ash" → "aspen" (native parity)
  expect(await inspect(page, 'single')).toMatchObject({
    value: 'aspen', selectedIndex: 1, expanded: 'false', popHidden: true,
  });
  // exactly ONE commit — one input + one change
  expect((await eventsFor(page, 'single')).map((e) => e.type)).toEqual(['input', 'change']);
});

test('keyboard: printable keys with Ctrl/Alt/Meta never typeahead (browser shortcuts pass through)', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  // "c" bare would typeahead-commit "codex" while closed (proven above) — the
  // same letter under a modifier is a browser shortcut and must do NOTHING
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Alt+c');
  expect(await inspect(page, 'pure')).toMatchObject({
    value: 'fresh', selectedIndex: 2, expanded: 'false', popHidden: true,
  });
  expect(await eventsFor(page, 'pure')).toEqual([]); // no commit, no events
});

test('keyboard: APG Alt+Arrow chords — Alt+ArrowDown opens, Alt+ArrowUp commits the active option and closes', async ({ page }) => {
  await armEvents(page);
  const btn = page.locator('#pure button');
  await btn.focus();
  await page.keyboard.press('Alt+ArrowDown'); // closed chord: opens, commits nothing
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o2'); // at the selection
  expect(await eventsFor(page, 'pure')).toEqual([]);
  await page.keyboard.press('ArrowDown'); // active → o3 ("off")
  await page.keyboard.press('Alt+ArrowUp'); // open chord: commit active + close
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await inspect(page, 'pure')).toMatchObject({
    value: 'off', selectedIndex: 3, popHidden: true, activeDesc: null,
  });
  expect((await eventsFor(page, 'pure')).map((e) => e.type)).toEqual(['input', 'change']); // exactly one commit
});

/* -------------------------------------------------- programmatic writes */

test('programmatic value/selectedIndex writes fire no events', async ({ page }) => {
  await armEvents(page);
  const r = await page.evaluate(() => {
    const el = document.getElementById('pure');
    el.value = 'off';
    const afterValue = { value: el.value, selectedIndex: el.selectedIndex };
    el.selectedIndex = 0;
    const afterIndex = { value: el.value, selectedIndex: el.selectedIndex };
    return { afterValue, afterIndex };
  });
  expect(r.afterValue).toEqual({ value: 'off', selectedIndex: 3 });
  expect(r.afterIndex).toEqual({ value: 'codex', selectedIndex: 0 });
  expect(await eventsFor(page, 'pure')).toEqual([]);
});

test('programmatic: pre-connect value/selectedIndex writes resolve against the option tags', async ({ page }) => {
  await armEvents(page);
  const r = await page.evaluate(() => {
    const build = (id) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', id);
      for (const [v, t] of [['a', 'Aye'], ['b', 'Bee'], ['c', 'Sea']]) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = t;
        el.append(o);
      }
      return el;
    };
    const byValue = build('pre1');
    byValue.value = 'b'; // BEFORE connect — must not resolve against an empty list
    document.body.append(byValue); // connect → re-adopt keeps it (dirty preservation)
    const byIndex = build('pre2');
    byIndex.selectedIndex = 2;
    document.body.append(byIndex);
    return {
      byValue: { value: byValue.value, selectedIndex: byValue.selectedIndex },
      byIndex: { value: byIndex.value, selectedIndex: byIndex.selectedIndex },
    };
  });
  expect(r.byValue).toEqual({ value: 'b', selectedIndex: 1 });
  expect(r.byIndex).toEqual({ value: 'c', selectedIndex: 2 });
  expect(await eventsFor(page, 'pre1')).toEqual([]); // still programmatic — no events
  expect(await eventsFor(page, 'pre2')).toEqual([]);
});

test('programmatic: selectedIndex setter and item() apply WebIDL numeric coercion', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'coerce';
    el.setAttribute('name', 'coerce');
    for (const [v, t] of [['a', 'Aye'], ['b', 'Bee'], ['c', 'Sea']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    const out = {};
    el.selectedIndex = '1'; // string → ToNumber → index 1
    out.str = { value: el.value, selectedIndex: el.selectedIndex };
    el.selectedIndex = NaN; // non-finite → 0
    out.nan = { value: el.value, selectedIndex: el.selectedIndex };
    el.selectedIndex = 1.9; // truncates toward zero → index 1
    out.frac = { value: el.value, selectedIndex: el.selectedIndex };
    el.selectedIndex = Infinity; // non-finite → 0
    out.inf = { value: el.value, selectedIndex: el.selectedIndex };
    el.selectedIndex = 99; // out of range still clears to -1
    out.range = { value: el.value, selectedIndex: el.selectedIndex };
    out.item = { frac: el.item(1.9)?.value ?? null, neg: el.item(-1) }; // unsigned long: negative → null
    return out;
  });
  expect(r.str).toEqual({ value: 'b', selectedIndex: 1 });
  expect(r.nan).toEqual({ value: 'a', selectedIndex: 0 });
  expect(r.frac).toEqual({ value: 'b', selectedIndex: 1 });
  expect(r.inf).toEqual({ value: 'a', selectedIndex: 0 });
  expect(r.range).toEqual({ value: '', selectedIndex: -1 });
  expect(r.item).toEqual({ frac: 'b', neg: null });
});

test('programmatic: same-task append + value write resolves against the FRESH options (no stale adoption)', async ({ page }) => {
  await armEvents(page);
  const r = await page.evaluate(async () => {
    const el = document.createElement('mythical-select');
    el.id = 'sync1';
    el.setAttribute('name', 'sync1');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'c');
    o.textContent = 'charlie row';
    el.append(o); // observer record queued — the async callback has NOT run yet
    el.value = 'c'; // same task: must resolve against the fresh list (native is synchronous)
    const immediate = { value: el.value, selectedIndex: el.selectedIndex };
    await new Promise((res) => setTimeout(res, 0)); // …and no observer replay may "correct" it back
    return { immediate, settled: { value: el.value, selectedIndex: el.selectedIndex, length: el.length } };
  });
  expect(r.immediate).toEqual({ value: 'c', selectedIndex: 2 });
  expect(r.settled).toEqual({ value: 'c', selectedIndex: 2, length: 3 });
  expect(await eventsFor(page, 'sync1')).toEqual([]); // programmatic writes stay silent
});

test('programmatic: same-task append is visible to options/length/item reads', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'sync2';
    el.setAttribute('name', 'sync2');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'c');
    o.textContent = 'charlie row';
    el.append(o); // same task — no macrotask before the reads below
    return {
      length: el.length,
      last: el.item(2),
      values: el.options.map((x) => x.value),
      selection: { value: el.value, selectedIndex: el.selectedIndex }, // kept on "a"
    };
  });
  expect(r.length).toBe(3);
  expect(r.last).toMatchObject({ value: 'c', text: 'charlie row', index: 2 });
  expect(r.values).toEqual(['a', 'b', 'c']);
  expect(r.selection).toEqual({ value: 'a', selectedIndex: 0 });
});

test('options snapshot reports CURRENT selectedness, not the adoption-time flag', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.getElementById('pure');
    const before = el.options.map((o) => o.selected);
    el.value = 'off'; // move the selection off the [selected] option
    const after = el.options.map((o) => o.selected);
    return { before, after };
  });
  expect(r.before).toEqual([false, false, true, false]); // [selected] sits on "fresh"
  expect(r.after).toEqual([false, false, false, true]); // the flag follows the selection
});

/* ------------------------------------------------- option canonicalization */

test('canonicalization: missing value derives from whitespace-collapsed text in both authoring modes', async ({ page }) => {
  const r = await page.evaluate(() => {
    const pure = document.createElement('mythical-select');
    pure.id = 'ws-pure';
    pure.setAttribute('name', 'ws-pure');
    const po = document.createElement('mythical-option');
    po.textContent = '  alpha \n\t  row  '; // no value attribute — implicit value
    pure.append(po);
    const host = document.createElement('mythical-select');
    host.id = 'ws-wrap';
    const sel = document.createElement('select');
    sel.name = 'ws-wrap';
    const no = document.createElement('option');
    no.textContent = '  alpha \n\t  row  ';
    sel.append(no);
    host.append(sel);
    document.body.append(pure, host);
    const facts = (el) => ({
      value: el.value,
      text: el.item(0).text,
      label: el.item(0).label,
      trigger: el.shadowRoot.querySelector('#label').textContent,
    });
    return { pure: facts(pure), wrapped: facts(host) };
  });
  const want = { value: 'alpha row', text: 'alpha row', label: 'alpha row', trigger: 'alpha row' };
  expect(r.pure).toEqual(want); // strip-and-collapse, like HTMLOptionElement.value/.text
  expect(r.wrapped).toEqual(want); // read through the native canonical getters
});

test('canonicalization: option[label] overrides the DISPLAY text but keeps the text-derived value', async ({ page }) => {
  const r = await page.evaluate(() => {
    const mk = (id, optTag, selTag) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', id);
      const o = document.createElement(optTag);
      o.setAttribute('label', 'Pretty');
      o.textContent = 'ugly value'; // no value attribute — value stays text-derived
      const p = document.createElement(optTag);
      p.setAttribute('value', 'x');
      p.textContent = 'second';
      if (selTag) {
        const sel = document.createElement('select');
        sel.name = id;
        sel.append(o, p);
        el.append(sel);
      } else el.append(o, p);
      document.body.append(el);
      return {
        value: el.value,
        trigger: el.shadowRoot.querySelector('#label').textContent,
        row: el.shadowRoot.querySelector('.opt span').textContent,
        snap: { value: el.item(0).value, text: el.item(0).text, label: el.item(0).label },
      };
    };
    return { pure: mk('lab-pure', 'mythical-option'), wrapped: mk('lab-wrap', 'option', true) };
  });
  const want = {
    value: 'ugly value', // label never feeds the value
    trigger: 'Pretty', // …but IS the display text on the trigger…
    row: 'Pretty', // …and in the listbox row
    snap: { value: 'ugly value', text: 'ugly value', label: 'Pretty' },
  };
  expect(r.pure).toEqual(want);
  expect(r.wrapped).toEqual(want);
});

test('canonicalization: NBSP survives — only ASCII whitespace collapses (native parity)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const TXT = '  10\u00a0GB \n\t '; // ASCII whitespace around, NBSP inside
    // native reference: option canonicalization strips-and-collapses ASCII
    // whitespace ONLY — the NBSP is PRESERVED in .value/.text/.label
    const nat = document.createElement('option');
    nat.textContent = TXT;
    const natSel = document.createElement('select');
    natSel.append(nat);
    document.body.append(natSel);
    const el = document.createElement('mythical-select');
    el.id = 'nbsp1';
    el.setAttribute('name', 'nbsp1');
    const o = document.createElement('mythical-option');
    o.textContent = TXT; // no value attribute — implicit value
    el.append(o);
    document.body.append(el);
    return {
      native: { value: nat.value, text: nat.text, label: nat.label },
      host: {
        value: el.value,
        text: el.item(0).text,
        label: el.item(0).label,
        trigger: el.shadowRoot.querySelector('#label').textContent,
      },
    };
  });
  const NB = '10\u00a0GB';
  expect(r.native).toEqual({ value: NB, text: NB, label: NB }); // self-documentation
  expect(r.host).toEqual({ value: NB, text: NB, label: NB, trigger: NB });
});

/* --------------------------------------------------------- form integration */

test('form: FormData reflects the value in both authoring modes; disabled excluded', async ({ page }) => {
  const fd = await page.evaluate(() => {
    const entries = {};
    for (const [k, v] of new FormData(document.getElementById('form'))) entries[k] = v;
    return entries;
  });
  expect(fd['pure']).toBe('fresh');
  expect(fd['wrapped']).toBe('p1'); // name moved from the wrapped native onto the host
  expect(fd['chip']).toBe('strict');
  expect(fd['required-choice']).toBe('');
  expect('disabled-choice' in fd).toBe(false); // disabled controls never submit
});

test('form: a selected option disabled after the fact submits nothing; re-enabling restores the entry', async ({ page }) => {
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'k2form';
    const el = document.createElement('mythical-select');
    el.id = 'k2sel';
    el.setAttribute('name', 'k2');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row'], ['c', 'charlie row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    form.append(el);
    document.body.append(form);
  });
  await page.locator('#k2sel button').click();
  await page.locator('#k2sel .opt[data-i="1"]').click(); // user commit "b"
  const r = await page.evaluate(async () => {
    const form = document.getElementById('k2form');
    const el = document.getElementById('k2sel');
    const before = new FormData(form).get('k2');
    el.children[1].setAttribute('disabled', ''); // disable the SELECTED option → re-adoption
    // SYNCHRONOUS: FormData built in the SAME task as the mutation must
    // already drop the entry (native is synchronous — the formdata-event
    // reconciliation corrects the stale internals serialization)
    const syncNoEntry = !new FormData(form).has('k2');
    await new Promise((res) => setTimeout(res, 0));
    const whileDisabled = {
      hasEntry: new FormData(form).has('k2'), // native: selected-but-disabled submits NOTHING
      value: el.value, // …while the selection itself stays (native keeps it selected)
      selectedIndex: el.selectedIndex,
    };
    el.children[1].removeAttribute('disabled'); // re-enable → the entry returns
    const syncRestored = new FormData(form).get('k2'); // same task — already back
    await new Promise((res) => setTimeout(res, 0));
    const after = new FormData(form).get('k2');
    return { before, syncNoEntry, whileDisabled, syncRestored, after };
  });
  expect(r.before).toBe('b');
  expect(r.syncNoEntry).toBe(true);
  expect(r.whileDisabled).toEqual({ hasEntry: false, value: 'b', selectedIndex: 1 });
  expect(r.syncRestored).toBe('b');
  expect(r.after).toBe('b');

  // …and the validity-facing members drain too: changing a required
  // placeholder option's value must reach checkValidity() in the SAME task
  // as the mutation (native constraint validation is synchronous)
  const v = await page.evaluate(async () => {
    const req = document.getElementById('required-sel');
    const beforeFix = req.checkValidity(); // placeholder selected → valueMissing
    req.children[0].setAttribute('value', 'x'); // no longer the placeholder shape
    const syncValid = req.checkValidity(); // same task — must already be true
    const syncMissing = req.validity.valueMissing;
    await new Promise((res) => setTimeout(res, 0)); // …and no observer replay flips it back
    return { beforeFix, syncValid, syncMissing, settledValid: req.checkValidity() };
  });
  expect(v).toEqual({ beforeFix: false, syncValid: true, syncMissing: false, settledValid: true });
});

/** Build a form with <input name=NAME value="native"> + two mythical-selects
 *  sharing NAME (document order: input, selA, selB) for the occurrence-aware
 *  formdata reconciliation tests. rowsA/rowsB = [value, text][] per select —
 *  no [selected], so each select defaults to its first option. */
async function makeDupForm(page, name, rowsA, rowsB) {
  await page.evaluate(({ name, rowsA, rowsB }) => {
    const form = document.createElement('form');
    form.id = `${name}-form`;
    const input = document.createElement('input');
    input.name = name;
    input.value = 'native';
    form.append(input);
    const mk = (id, rows) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', name);
      for (const [v, t] of rows) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = t;
        el.append(o);
      }
      form.append(el);
    };
    mk(`${name}-a`, rowsA);
    mk(`${name}-b`, rowsB);
    document.body.append(form);
  }, { name, rowsA, rowsB });
}

test('form: same-name siblings — reconciliation edits only THIS host\'s entry (occurrence-aware)', async ({ page }) => {
  // both selects default to the SAME stale value 'a' — the per-value occurrence
  // cursor must tell their entries apart
  await makeDupForm(page, 'dup', [['a', 'alpha row'], ['b', 'bravo row']], [['a', 'alpha row'], ['b', 'bravo row']]);
  const r = await page.evaluate(async () => {
    // native reference: the same shape with REAL selects (input + two
    // same-name selects, equal values) — the host expectations below must
    // match this engine's own entry list at every step
    const natForm = document.createElement('form');
    const ninp = document.createElement('input');
    ninp.name = 'ndup';
    ninp.value = 'native';
    natForm.append(ninp);
    const mkNat = () => {
      const s = document.createElement('select');
      s.name = 'ndup';
      for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row']]) {
        const o = document.createElement('option');
        o.value = v;
        o.text = t;
        s.append(o);
      }
      natForm.append(s);
      return s;
    };
    const natA = mkNat();
    const natB = mkNat();
    document.body.append(natForm);
    const natAll = () => new FormData(natForm).getAll('ndup').map(String);

    const form = document.getElementById('dup-form');
    const getAll = () => new FormData(form).getAll('dup').map(String);
    const nat = { baseline: natAll() };
    const baseline = getAll(); // input + both selects, document order
    // same-task mutation on the SECOND select: its stale value EQUALS the
    // first select's — the reconciler must edit the SECOND 'a', not the sibling's
    natB.options[0].setAttribute('value', 'a2');
    nat.afterB = natAll(); // native option lists are synchronous
    document.getElementById('dup-b').children[0].setAttribute('value', 'a2');
    const afterB = getAll(); // same task — reconciled via the formdata event
    await new Promise((res) => setTimeout(res, 0));
    const settledB = getAll(); // observer landed — served natively, no edits
    // same-task mutation on the FIRST select
    natA.options[0].setAttribute('value', 'a1');
    nat.afterA = natAll();
    document.getElementById('dup-a').children[0].setAttribute('value', 'a1');
    const afterA = getAll(); // same task
    await new Promise((res) => setTimeout(res, 0));
    const settledA = getAll();
    natForm.remove();
    return { nat, baseline, afterB, settledB, afterA, settledA };
  });
  // self-documentation: the real-native answer the host must replicate
  expect(r.nat).toEqual({
    baseline: ['native', 'a', 'a'],
    afterB: ['native', 'a', 'a2'],
    afterA: ['native', 'a1', 'a2'],
  });
  expect(r.baseline).toEqual(['native', 'a', 'a']); // all three, document order
  expect(r.afterB).toEqual(['native', 'a', 'a2']); // ONLY dup-b's entry changed — order kept
  expect(r.settledB).toEqual(['native', 'a', 'a2']);
  expect(r.afterA).toEqual(['native', 'a1', 'a2']);
  expect(r.settledA).toEqual(['native', 'a1', 'a2']);
});

test('form: same-name siblings — disabling one select\'s option removes only ITS entry', async ({ page }) => {
  // distinct values here so WHICH entry vanished is observable
  await makeDupForm(page, 'dup2', [['a', 'alpha row'], ['x', 'xray row']], [['b', 'bravo row'], ['y', 'yankee row']]);
  const r = await page.evaluate(async () => {
    const form = document.getElementById('dup2-form');
    const getAll = () => new FormData(form).getAll('dup2').map(String);
    const selA = document.getElementById('dup2-a');
    const selB = document.getElementById('dup2-b');
    const baseline = getAll(); // ['native', 'a', 'b']
    selB.children[0].setAttribute('disabled', ''); // disable selB's SELECTED option
    const afterB = getAll(); // same task — only selB's entry drops
    await new Promise((res) => setTimeout(res, 0));
    selA.children[0].setAttribute('disabled', ''); // now selA's too
    const afterBoth = getAll(); // same task — the input's entry alone survives
    await new Promise((res) => setTimeout(res, 0));
    const settled = getAll();
    // re-enable BOTH in one task: entries return (tail inserts keep sibling order)
    selA.children[0].removeAttribute('disabled');
    selB.children[0].removeAttribute('disabled');
    const restoredSync = getAll(); // same task
    await new Promise((res) => setTimeout(res, 0));
    const restored = getAll(); // next task — served natively, document order
    return { baseline, afterB, afterBoth, settled, restoredSync, restored };
  });
  expect(r.baseline).toEqual(['native', 'a', 'b']);
  expect(r.afterB).toEqual(['native', 'a']); // selB's entry ONLY — selA + input untouched
  expect(r.afterBoth).toEqual(['native']);
  expect(r.settled).toEqual(['native']);
  expect(r.restoredSync).toEqual(['native', 'a', 'b']);
  expect(r.restored).toEqual(['native', 'a', 'b']);
});

test('form: same-task reconciliation keeps GLOBAL cross-name entry order (x, y, z)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const inp = (name, value) => Object.assign(document.createElement('input'), { name, value });
    // native reference: a same-task option mutation on a real select leaves
    // the form's entry list order untouched — [x, y, z] stays [x, y, z]
    const natForm = document.createElement('form');
    const nsel = document.createElement('select');
    nsel.name = 'y';
    const nopt = document.createElement('option');
    nopt.value = 'y1';
    nopt.text = 'yankee row';
    nsel.append(nopt);
    natForm.append(inp('x', 'before'), nsel, inp('z', 'after'));
    document.body.append(natForm);
    nopt.setAttribute('value', 'y2'); // native option lists are synchronous
    const native = [...new FormData(natForm)].map(([n, v]) => [n, String(v)]);

    const form = document.createElement('form');
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'y');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'y1');
    o.textContent = 'yankee row';
    el.append(o);
    form.append(inp('x', 'before'), el, inp('z', 'after'));
    document.body.append(form);
    const baseline = [...new FormData(form)].map(([n, v]) => [n, String(v)]);
    o.setAttribute('value', 'y2'); // same-task mutation → formdata reconciliation
    const after = [...new FormData(form)].map(([n, v]) => [n, String(v)]);
    return { native, baseline, after };
  });
  expect(r.native).toEqual([['x', 'before'], ['y', 'y2'], ['z', 'after']]); // self-documentation
  expect(r.baseline).toEqual([['x', 'before'], ['y', 'y1'], ['z', 'after']]);
  // the y-correction must land IN PLACE — a per-name delete+re-append would
  // come back as [x, z, y], destroying cross-name order
  expect(r.after).toEqual([['x', 'before'], ['y', 'y2'], ['z', 'after']]);
});

test('form: an equal-valued native input BEFORE the host is never misclaimed', async ({ page }) => {
  const r = await page.evaluate(() => {
    // native reference: input name=dup value "a" ahead of a native select
    // sitting on option "a"; retargeting the option to "b" in the same task
    // gives ['a', 'b'] — the input's entry stays first and untouched
    const natForm = document.createElement('form');
    const ninp = document.createElement('input');
    ninp.name = 'dup';
    ninp.value = 'a';
    const nsel = document.createElement('select');
    nsel.name = 'dup';
    const nopt = document.createElement('option');
    nopt.value = 'a';
    nopt.text = 'alpha row';
    nsel.append(nopt);
    natForm.append(ninp, nsel);
    document.body.append(natForm);
    nopt.setAttribute('value', 'b');
    const native = new FormData(natForm).getAll('dup').map(String);

    const form = document.createElement('form');
    const input = document.createElement('input');
    input.name = 'dup';
    input.value = 'a';
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'dup');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'alpha row';
    el.append(o);
    form.append(input, el);
    document.body.append(form);
    const baseline = new FormData(form).getAll('dup').map(String);
    o.setAttribute('value', 'b'); // the host's stale value EQUALS the preceding input's
    const after = new FormData(form).getAll('dup').map(String);
    return { native, baseline, after };
  });
  expect(r.native).toEqual(['a', 'b']); // self-documentation
  expect(r.baseline).toEqual(['a', 'a']);
  // the correction must claim the HOST's occurrence (the LAST equal-valued
  // slot), never the preceding input's — its 'a' stays first, unchanged
  expect(r.after).toEqual(['a', 'b']);
});

test('form: reset restores the initial selection in both authoring modes', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('pure').value = 'off';
    document.getElementById('wrapped').value = 'p3';
    document.getElementById('form').reset();
  });
  expect(await inspect(page, 'pure')).toMatchObject({ value: 'fresh', selectedIndex: 2 });
  expect(await inspect(page, 'wrapped')).toMatchObject({ value: 'p1', selectedIndex: 1 });
});

test('form: reset clears selection dirtiness — [selected] defaults win again', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'rst';
    el.setAttribute('name', 'rst');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row'], ['c', 'charlie row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.getElementById('form').append(el); // in-form so formResetCallback fires
  });
  await page.locator('#rst button').click();
  await page.locator('#rst .opt[data-i="2"]').click(); // user commit → dirty
  await page.evaluate(() => document.getElementById('form').reset()); // → pristine again
  expect(await page.evaluate(() => document.getElementById('rst').value)).toBe('a');
  await page.evaluate(() => {
    document.getElementById('rst').children[1].setAttribute('selected', ''); // "b"
  });
  // dirtiness was reset with the form → the changed [selected] default moves it
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('rst');
    return { value: el.value, selectedIndex: el.selectedIndex };
  })).toEqual({ value: 'b', selectedIndex: 1 });
});

test('form: formStateRestoreCallback restores the selection silently', async ({ page }) => {
  await armEvents(page);
  const r = await page.evaluate(() => {
    const el = document.getElementById('pure');
    el.formStateRestoreCallback('off', 'restore'); // direct call with a value string
    const fd = new FormData(document.getElementById('form'));
    return { value: el.value, selectedIndex: el.selectedIndex, submitted: fd.get('pure') };
  });
  expect(r).toEqual({ value: 'off', selectedIndex: 3, submitted: 'off' }); // FormData reflects it
  expect(await eventsFor(page, 'pure')).toEqual([]); // restore fires no input/change
});

test('form: fieldset[disabled] disables the control (data-form-disabled path)', async ({ page }) => {
  await page.evaluate(() => {
    const fs = document.createElement('fieldset');
    fs.id = 'fs';
    const el = document.createElement('mythical-select');
    el.id = 'fsel';
    el.setAttribute('name', 'fsel');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'a');
    o.textContent = 'A';
    el.append(o);
    fs.append(el);
    document.getElementById('form').append(fs);
    fs.disabled = true;
  });
  await expect(page.locator('#fsel')).toHaveAttribute('data-form-disabled');
  await expect(page.locator('#fsel button')).toBeDisabled();
  await page.evaluate(() => { document.getElementById('fs').disabled = false; });
  await expect(page.locator('#fsel')).not.toHaveAttribute('data-form-disabled');
  await expect(page.locator('#fsel button')).toBeEnabled();
});

test('form: clicking the external label focuses the control (delegatesFocus)', async ({ page }) => {
  await page.locator('#pure-label').click();
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('pure');
    return document.activeElement === el &&
      el.shadowRoot.activeElement === el.shadowRoot.querySelector('button');
  })).toBe(true);
  // native parity: a label click focuses the select but never opens the picker
  await expect(page.locator('#pure button')).toHaveAttribute('aria-expanded', 'false');
  // host.focus() delegates the same way
  await page.evaluate(() => {
    document.getElementById('submit').focus();
    document.getElementById('wrapped').focus();
  });
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('wrapped');
    return document.activeElement === el &&
      el.shadowRoot.activeElement === el.shadowRoot.querySelector('button');
  })).toBe(true);
});

/* ------------------------------------------------------------------ validity */

test('validity: required + placeholder → valueMissing until a real value is committed', async ({ page }) => {
  const v = await page.evaluate(() => {
    const el = document.getElementById('required-sel');
    return { valid: el.checkValidity(), missing: el.validity.valueMissing, willValidate: el.willValidate };
  });
  expect(v).toEqual({ valid: false, missing: true, willValidate: true });
});

test('validity: only the FIRST direct-child empty option is the placeholder — other empty values are valid', async ({ page }) => {
  await page.evaluate(() => {
    window.__v3 = { submits: 0 };
    const form = document.createElement('form');
    form.id = 'v3form';
    const el = document.createElement('mythical-select');
    el.id = 'v3sel';
    el.setAttribute('name', 'v3');
    el.setAttribute('required', '');
    const g = document.createElement('mythical-optgroup');
    g.setAttribute('label', 'Grouped');
    for (const [v, t] of [['', 'None (grouped)'], ['a', 'Alpha']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      g.append(o);
    }
    el.append(g);
    const later = document.createElement('mythical-option');
    later.setAttribute('value', '');
    later.textContent = 'None (ungrouped, later)';
    el.append(later); // an empty-valued option that is NOT first
    form.append(el);
    document.body.append(form);
    form.addEventListener('submit', (e) => { e.preventDefault(); window.__v3.submits++; });
  });
  // default selection = first option: value "" but inside a GROUP → not the
  // native placeholder label option → the control is VALID and the form submits
  const grouped = await page.evaluate(() => {
    const el = document.getElementById('v3sel');
    document.getElementById('v3form').requestSubmit();
    return {
      value: el.value,
      selectedIndex: el.selectedIndex,
      valid: el.checkValidity(),
      missing: el.validity.valueMissing,
      submits: window.__v3.submits,
    };
  });
  expect(grouped).toEqual({ value: '', selectedIndex: 0, valid: true, missing: false, submits: 1 });
  // a LATER direct-child empty-valued option is not the placeholder either
  const later = await page.evaluate(() => {
    const el = document.getElementById('v3sel');
    el.selectedIndex = 2;
    document.getElementById('v3form').requestSubmit();
    return { value: el.value, valid: el.checkValidity(), missing: el.validity.valueMissing, submits: window.__v3.submits };
  });
  expect(later).toEqual({ value: '', valid: true, missing: false, submits: 2 });
  // the true placeholder shape (FIRST option, direct child, value "") stays valueMissing
  const placeholder = await page.evaluate(() => {
    const el = document.getElementById('required-sel');
    return { valid: el.checkValidity(), missing: el.validity.valueMissing };
  });
  expect(placeholder).toEqual({ valid: false, missing: true });
});

test('validity: blocked submit sets [data-user-invalid]; committing clears it and submits', async ({ page }) => {
  await page.evaluate(() => {
    window.__submits = 0;
    document.getElementById('form').addEventListener('submit', (e) => {
      e.preventDefault();
      window.__submits++;
    });
  });

  await page.locator('#submit').click(); // blocked: required-sel is valueMissing
  await expect(page.locator('#required-sel')).toHaveAttribute('data-user-invalid');
  expect(await page.evaluate(() => window.__submits)).toBe(0);

  // commit a real value through the UI → invalid state clears
  await page.locator('#required-sel button').click();
  await page.locator('#required-sel .opt[data-i="1"]').click(); // "Alpha choice"
  await expect(page.locator('#required-sel')).not.toHaveAttribute('data-user-invalid');
  expect(await page.evaluate(() => document.getElementById('required-sel').checkValidity())).toBe(true);

  // Firefox keeps the native validation bubble from the blocked submit open and
  // CONSUMES the first click away from the anchored control to dismiss it (a
  // native <select> behaves identically). Click a neutral spot first so the
  // submit click below reaches the page on every engine.
  await page.mouse.click(5, 5);

  await page.locator('#submit').click(); // now allowed
  await expect.poll(() => page.evaluate(() => window.__submits)).toBe(1);
});

test('validity: trigger mirrors the required attribute as aria-required', async ({ page }) => {
  await expect(page.locator('#required-sel button')).toHaveAttribute('aria-required', 'true');
  await expect(page.locator('#pure button')).not.toHaveAttribute('aria-required');
  await page.evaluate(() => document.getElementById('pure').setAttribute('required', ''));
  await expect(page.locator('#pure button')).toHaveAttribute('aria-required', 'true');
  await page.evaluate(() => document.getElementById('pure').removeAttribute('required'));
  await expect(page.locator('#pure button')).not.toHaveAttribute('aria-required');
});

test('validity: aria-invalid appears with the blocked-submit condition and clears on a valid commit', async ({ page }) => {
  const btn = page.locator('#required-sel button');
  // untouched → absent even though the control is already valueMissing
  await expect(btn).not.toHaveAttribute('aria-invalid');
  await page.evaluate(() => {
    document.getElementById('form').addEventListener('submit', (e) => e.preventDefault());
  });
  await page.locator('#submit').click(); // blocked: required-sel is valueMissing
  await expect(page.locator('#required-sel')).toHaveAttribute('data-user-invalid');
  await expect(btn).toHaveAttribute('aria-invalid', 'true'); // tracks the same condition
  await btn.click();
  await page.locator('#required-sel .opt[data-i="1"]').click(); // commit "Alpha choice"
  await expect(btn).not.toHaveAttribute('aria-invalid'); // valid again → reflection gone
  await expect(page.locator('#required-sel')).not.toHaveAttribute('data-user-invalid');
});

test('validity: setCustomValidity sets and clears customError', async ({ page }) => {
  const r = await page.evaluate(() => {
    const el = document.getElementById('chip');
    el.setCustomValidity('x');
    const set = {
      valid: el.checkValidity(),
      customError: el.validity.customError,
      message: el.validationMessage,
    };
    el.setCustomValidity('');
    const cleared = { valid: el.checkValidity(), customError: el.validity.customError };
    return { set, cleared };
  });
  expect(r.set).toEqual({ valid: false, customError: true, message: 'x' });
  expect(r.cleared).toEqual({ valid: true, customError: false });
});

test('validity: setCustomValidity converts like WebIDL DOMString — 0 sets "0", only the empty string clears, zero-arg throws', async ({ page }) => {
  const r = await page.evaluate(() => {
    // native reference: the argument is converted with DOMString semantics —
    // setCustomValidity(0) sets the error "0" (invalid); a missing argument
    // is a required-argument TypeError; only the empty STRING clears
    const nat = document.createElement('select');
    document.body.append(nat);
    nat.setCustomValidity(0);
    const natSet = { valid: nat.checkValidity(), message: nat.validationMessage };
    let natThrew = false;
    try { nat.setCustomValidity(); } catch (err) { natThrew = err instanceof TypeError; }
    nat.setCustomValidity('');
    const natCleared = nat.checkValidity();
    nat.remove();

    const el = document.getElementById('chip');
    el.setCustomValidity(0);
    const set = {
      valid: el.checkValidity(),
      customError: el.validity.customError,
      message: el.validationMessage,
    };
    let threw = false;
    try { el.setCustomValidity(); } catch (err) { threw = err instanceof TypeError; }
    const afterThrow = el.validationMessage; // the failed call must not clear the error
    el.setCustomValidity('');
    const cleared = { valid: el.checkValidity(), customError: el.validity.customError };
    return { natSet, natThrew, natCleared, set, threw, afterThrow, cleared };
  });
  expect(r.natSet).toEqual({ valid: false, message: '0' }); // self-documentation
  expect(r.natThrew).toBe(true);
  expect(r.natCleared).toBe(true);
  expect(r.set).toEqual({ valid: false, customError: true, message: '0' });
  expect(r.threw).toBe(true);
  expect(r.afterThrow).toBe('0');
  expect(r.cleared).toEqual({ valid: true, customError: false });
});

test('validity: a custom error COMBINES with valueMissing — both flags true, custom message preferred', async ({ page }) => {
  const r = await page.evaluate(() => {
    // #required-sel sits on its value="" placeholder → valueMissing; native
    // COMBINES flags: adding a custom error must not replace valueMissing
    const el = document.getElementById('required-sel');
    el.setCustomValidity('Pick a real lane');
    const both = {
      customError: el.validity.customError,
      valueMissing: el.validity.valueMissing,
      message: el.validationMessage, // the custom text outranks the missing one
      valid: el.checkValidity(),
    };
    el.setCustomValidity(''); // clearing the custom error leaves valueMissing
    const cleared = {
      customError: el.validity.customError,
      valueMissing: el.validity.valueMissing,
      hasMessage: el.validationMessage.length > 0, // the valueMissing message returns
      valid: el.checkValidity(),
    };
    return { both, cleared };
  });
  expect(r.both).toEqual({ customError: true, valueMissing: true, message: 'Pick a real lane', valid: false });
  expect(r.cleared).toEqual({ customError: false, valueMissing: true, hasMessage: true, valid: false });
});

/* ------------------------------------------------- wrapped-native contract */

test('wrapped-native: user commit syncs the hidden native select (host→native)', async ({ page }) => {
  await page.locator('#wrapped button').click();
  await page.locator('#wrapped .opt[data-i="3"]').click(); // "P3 someday"
  expect(await inspect(page, 'wrapped')).toMatchObject({ value: 'p3', selectedIndex: 3 });
  const native = await page.evaluate(() => {
    const sel = document.getElementById('wrapped-native');
    return { selectedIndex: sel.selectedIndex, value: sel.value };
  });
  expect(native).toEqual({ selectedIndex: 3, value: 'p3' });
});

test('wrapped-native: pre-upgrade script-set selection wins over [selected]', async ({ page }) => {
  const r = await page.evaluate(() => {
    // Build detached: the upgrade (adoption) only happens on connect.
    const host = document.createElement('mythical-select');
    const sel = document.createElement('select');
    sel.name = 'late';
    for (const [v, t, s] of [['a', 'Alpha', false], ['b', 'Beta', true], ['c', 'Gamma', false]]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = t;
      if (s) o.setAttribute('selected', '');
      sel.append(o);
    }
    sel.selectedIndex = 2; // script-set LIVE selection, beats the [selected] on "b"
    host.append(sel);
    document.body.append(host); // connect → adopt
    return { value: host.value, selectedIndex: host.selectedIndex };
  });
  expect(r).toEqual({ value: 'c', selectedIndex: 2 });
});

test('wrapped-native: a live no-selection (selectedIndex -1) at upgrade is adopted — no first-enabled fallback', async ({ page }) => {
  const r = await page.evaluate(() => {
    // native reference: clearing selectedIndex sticks — the [selected] default
    // does not re-apply, the select stays at -1 and submits nothing
    const refForm = document.createElement('form');
    const ref = document.createElement('select');
    ref.name = 'ref';
    for (const [v, s] of [['a', false], ['b', true], ['c', false]]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      if (s) o.setAttribute('selected', '');
      ref.append(o);
    }
    refForm.append(ref);
    document.body.append(refForm);
    ref.selectedIndex = -1;
    const form = document.createElement('form');
    form.id = 'nsf';
    const mk = (id, valueAttr) => {
      const host = document.createElement('mythical-select');
      host.id = id;
      if (valueAttr !== null) host.setAttribute('value', valueAttr);
      const sel = document.createElement('select');
      sel.name = id;
      for (const [v, t, s] of [['a', 'Alpha', false], ['b', 'Beta', true], ['c', 'Gamma', false]]) {
        const o = document.createElement('option');
        o.value = v;
        o.text = t;
        if (s) o.setAttribute('selected', '');
        sel.append(o);
      }
      sel.selectedIndex = -1; // script CLEARED the live selection pre-upgrade
      host.append(sel);
      form.append(host);
      return host;
    };
    const plain = mk('ns-plain', null);
    const attr = mk('ns-attr', 'c'); // matching host value attribute still wins
    document.body.append(form); // connect → upgrade
    const fd = new FormData(form);
    return {
      native: { value: ref.value, selectedIndex: ref.selectedIndex, entry: new FormData(refForm).has('ref') },
      plain: { value: plain.value, selectedIndex: plain.selectedIndex, entry: fd.has('ns-plain') },
      attr: { value: attr.value, selectedIndex: attr.selectedIndex, entry: fd.get('ns-attr') },
    };
  });
  expect(r.native).toEqual({ value: '', selectedIndex: -1, entry: false }); // self-documentation
  expect(r.plain).toEqual({ value: '', selectedIndex: -1, entry: false }); // adopted no-selection, submits nothing
  expect(r.attr).toEqual({ value: 'c', selectedIndex: 2, entry: 'c' }); // attrPending branch unchanged
});

/** Pre-upgrade dirtiness trio (P2): a wrapped native whose LIVE selection
 *  differs from its [selected]-derived default upgrades DIRTY (script-touched
 *  pre-upgrade); live == derived default stays pristine. `touch` mutates the
 *  select pre-upgrade (null = untouched); `change` mutates a default after. */
async function preUpgradeDirtiness(page, { touch, change }) {
  return page.evaluate(async ({ touchSel, changeIdx, changeOp }) => {
    const mk = () => {
      const sel = document.createElement('select');
      for (const [v, t, s] of [['a', 'Alpha', true], ['b', 'Beta', false], ['c', 'Gamma', false]]) {
        const o = document.createElement('option');
        o.value = v;
        o.text = t;
        if (s) o.setAttribute('selected', '');
        sel.append(o);
      }
      return sel;
    };
    const apply = (sel) => {
      if (changeOp === 'remove') sel.options[changeIdx].removeAttribute('selected');
      else sel.options[changeIdx].setAttribute('selected', '');
    };
    // native reference: the same pre-upgrade touch + later default change on
    // a REAL select — the host assertions must match this engine's own answer
    const nat = mk();
    document.body.append(nat);
    if (touchSel !== null) nat.selectedIndex = touchSel;
    apply(nat);
    const native = { value: nat.value, selectedIndex: nat.selectedIndex };

    const host = document.createElement('mythical-select');
    const sel = mk();
    sel.name = 'pud';
    if (touchSel !== null) sel.selectedIndex = touchSel; // pre-upgrade script write
    host.append(sel);
    document.body.append(host); // connect → upgrade reads the live selection
    apply(sel); // the default changes AFTER upgrade
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    const out = { native, host: { value: host.value, selectedIndex: host.selectedIndex } };
    nat.remove(); host.remove();
    return out;
  }, { touchSel: touch, changeIdx: change.idx, changeOp: change.op });
}

test('wrapped-native: a pre-upgrade script-set selection upgrades DIRTY — a later default change keeps it', async ({ page }) => {
  // script picks B over the [selected] default A → live ≠ derived default →
  // dirty; removing A's [selected] later must NOT re-default (native parity:
  // the attribute removal touches an unselected option — no reset)
  const r = await preUpgradeDirtiness(page, { touch: 1, change: { idx: 0, op: 'remove' } });
  expect(r.native).toEqual({ value: 'b', selectedIndex: 1 }); // self-documentation
  expect(r.host).toEqual({ value: 'b', selectedIndex: 1 }); // dirty → B survives the default change
});

test('wrapped-native: a pre-upgrade script CLEAR with a [selected] default upgrades DIRTY — the -1 survives a later default change', async ({ page }) => {
  // live -1 while a [selected] exists is a script CLEAR → dirty; the adopted
  // no-selection must survive the later default change instead of resurrecting
  const r = await preUpgradeDirtiness(page, { touch: -1, change: { idx: 0, op: 'remove' } });
  expect(r.native).toEqual({ value: '', selectedIndex: -1 }); // self-documentation
  expect(r.host).toEqual({ value: '', selectedIndex: -1 }); // dirty no-selection → -1 stands
});

test('wrapped-native: an untouched wrapped select upgrades PRISTINE — a later [selected] change still moves it', async ({ page }) => {
  // no pre-upgrade script writes — live == derived default → pristine, so a
  // later [selected] on C moves the selection (native defaultSelected parity)
  const r = await preUpgradeDirtiness(page, { touch: null, change: { idx: 2, op: 'add' } });
  expect(r.native).toEqual({ value: 'c', selectedIndex: 2 }); // self-documentation
  expect(r.host).toEqual({ value: 'c', selectedIndex: 2 }); // pristine → the new default wins
});

test('wrapped-native: moving the native out of the host restores presentation, never the name', async ({ page }) => {
  await page.evaluate(() => {
    document.body.append(document.getElementById('wrapped-native')); // leaves the host
  });
  await expect.poll(() => page.evaluate(() => {
    const sel = document.getElementById('wrapped-native');
    return {
      visible: getComputedStyle(sel).display !== 'none',
      ariaHidden: sel.getAttribute('aria-hidden'),
      tabindex: sel.getAttribute('tabindex'),
      disabled: sel.hasAttribute('disabled'), // adoption force-disable comes off on departure
      named: sel.hasAttribute('name'), // the host keeps form identity — never re-added
    };
  })).toEqual({ visible: true, ariaHidden: null, tabindex: null, disabled: false, named: false });
  const focusable = await page.evaluate(() => {
    const sel = document.getElementById('wrapped-native');
    sel.focus();
    return document.activeElement === sel;
  });
  expect(focusable).toBe(true);

  // EXACT presentation restore: a native that had its own inline display and
  // tabindex gets those ORIGINAL values back, not cleared-to-empty ones.
  await page.evaluate(() => {
    const host = document.createElement('mythical-select');
    host.id = 'wrap2';
    const sel = document.createElement('select');
    sel.id = 'wrap2-native';
    sel.name = 'wrap2';
    sel.setAttribute('tabindex', '7');
    sel.setAttribute('style', 'display:inline-block');
    for (const v of ['x', 'y']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel);
    document.body.append(host); // upgrade snapshots the original presentation
  });
  // while adopted the native is inert (hidden, unfocusable, aria-hidden, disabled)
  expect(await page.evaluate(() => {
    const sel = document.getElementById('wrap2-native');
    return { display: sel.style.display, ariaHidden: sel.getAttribute('aria-hidden'), tabindex: sel.getAttribute('tabindex'), disabled: sel.disabled };
  })).toEqual({ display: 'none', ariaHidden: 'true', tabindex: '-1', disabled: true });
  await page.evaluate(() => {
    document.body.append(document.getElementById('wrap2-native')); // leaves the host
  });
  await expect.poll(() => page.evaluate(() => {
    const sel = document.getElementById('wrap2-native');
    return {
      display: sel.style.display, // the exact original inline value…
      ariaHidden: sel.getAttribute('aria-hidden'), // …original absence stays absent
      tabindex: sel.getAttribute('tabindex'), // original tabindex="7" back
      disabled: sel.hasAttribute('disabled'), // the author never disabled it — enabled again
      named: sel.hasAttribute('name'), // form identity still never returns
    };
  })).toEqual({ display: 'inline-block', ariaHidden: null, tabindex: '7', disabled: false, named: false });
});

test('wrapped-native: moving the native between hosts — the new owner reuses the ORIGINAL snapshot', async ({ page }) => {
  await page.evaluate(() => {
    const hostA = document.createElement('mythical-select');
    hostA.id = 'ha';
    const sel = document.createElement('select');
    sel.id = 'ha-native';
    sel.name = 'ha';
    for (const v of ['x', 'y']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    hostA.append(sel);
    const hostB = document.createElement('mythical-select');
    hostB.id = 'hb';
    document.body.append(hostA, hostB); // both connected; A adopts (snapshot + force-disable)
    hostB.append(sel); // synchronous transfer A → B
  });
  // B must not snapshot A's FORCED inert state as author state: host B stays
  // enabled, adopts the options, and A does not fight over the native (it stays
  // inert under its new owner; A is left optionless)
  await expect.poll(() => page.evaluate(() => {
    const b = document.getElementById('hb');
    const sel = document.getElementById('ha-native');
    return {
      bDisabled: b.hasAttribute('disabled'),
      bTrigger: b.shadowRoot.querySelector('button').disabled,
      bLength: b.length,
      bValue: b.value,
      aLength: document.getElementById('ha').length,
      // inline style, not computed: Firefox reports empty computed styles for
      // unslotted shadow-host children (not in the flat tree — never rendered)
      nativeInert: sel.style.display === 'none' && sel.disabled,
    };
  })).toEqual({ bDisabled: false, bTrigger: false, bLength: 2, bValue: 'x', aLength: 0, nativeInert: true });
  // leaving B entirely restores the ORIGINAL presentation exactly once —
  // including the author's (un)disabled state — and never the name
  await page.evaluate(() => document.body.append(document.getElementById('ha-native')));
  await expect.poll(() => page.evaluate(() => {
    const sel = document.getElementById('ha-native');
    return {
      visible: getComputedStyle(sel).display !== 'none',
      ariaHidden: sel.getAttribute('aria-hidden'),
      tabindex: sel.getAttribute('tabindex'),
      disabled: sel.hasAttribute('disabled'), // the author never disabled it
      named: sel.hasAttribute('name'), // form identity stays with the host
    };
  })).toEqual({ visible: true, ariaHidden: null, tabindex: null, disabled: false, named: false });
});

test('wrapped-native: a DETACHED host adopts and restores a departing native (observer lives from construction)', async ({ page }) => {
  await page.evaluate(async () => {
    const host = document.createElement('mythical-select');
    const sel = document.createElement('select');
    sel.id = 'det-native';
    sel.name = 'det';
    for (const v of ['x', 'y']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel); // host is NEVER connected — the constructor-time observer sees it
    window.__det = { host, sel };
    await new Promise((res) => setTimeout(res, 0)); // observer-driven adoption runs detached
  });
  // adopted while detached: host owns the options, the native is inert and un-named
  expect(await page.evaluate(() => {
    const { host, sel } = window.__det;
    return { length: host.length, value: host.value, display: sel.style.display, disabled: sel.disabled, named: sel.hasAttribute('name') };
  })).toEqual({ length: 2, value: 'x', display: 'none', disabled: true, named: false });
  // native departs the STILL-DETACHED host → presentation restored (never the name)
  await page.evaluate(() => document.body.append(window.__det.sel));
  await expect.poll(() => page.evaluate(() => {
    const { host, sel } = window.__det;
    return {
      display: sel.style.display,
      ariaHidden: sel.getAttribute('aria-hidden'),
      tabindex: sel.getAttribute('tabindex'),
      disabled: sel.hasAttribute('disabled'),
      named: sel.hasAttribute('name'),
      hostLength: host.length, // the detached host re-adopted to empty
    };
  })).toEqual({ display: '', ariaHidden: null, tabindex: null, disabled: false, named: false, hostLength: 0 });
});

test('wrapped-native: adopted native is force-disabled — no duplicate invalid, no independent submit block', async ({ page }) => {
  await page.evaluate(() => {
    window.__h1 = { hostInvalid: 0, nativeInvalid: 0, submits: 0 };
    const form = document.createElement('form');
    form.id = 'h1form';
    const host = document.createElement('mythical-select');
    host.id = 'h1sel';
    const sel = document.createElement('select');
    sel.id = 'h1native';
    sel.setAttribute('name', 'h1');
    sel.setAttribute('required', '');
    for (const [v, t] of [['', 'Choose…'], ['a', 'Alpha'], ['b', 'Beta']]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = t;
      sel.append(o);
    }
    host.append(sel);
    form.append(host);
    document.body.append(form);
    host.addEventListener('invalid', () => window.__h1.hostInvalid++);
    sel.addEventListener('invalid', () => window.__h1.nativeInvalid++);
    form.addEventListener('submit', (e) => { e.preventDefault(); window.__h1.submits++; });
  });
  // adoption force-disables the native (disabled controls are barred from
  // constraint validation and submission); required forwarded to the host, and
  // the forced disable must NOT leak onto the host as if the author set it
  expect(await page.evaluate(() => {
    const host = document.getElementById('h1sel');
    return {
      nativeDisabled: document.getElementById('h1native').disabled,
      nativeValidates: document.getElementById('h1native').willValidate,
      hostRequired: host.hasAttribute('required'),
      hostDisabled: host.hasAttribute('disabled'),
      triggerDisabled: host.shadowRoot.querySelector('button').disabled,
    };
  })).toEqual({ nativeDisabled: true, nativeValidates: false, hostRequired: true, hostDisabled: false, triggerDisabled: false });

  // placeholder selected → the HOST blocks the submit with exactly ONE invalid
  // event in total; the disabled inner native contributes zero
  await page.evaluate(() => document.getElementById('h1form').requestSubmit());
  expect(await page.evaluate(() => window.__h1)).toEqual({ hostInvalid: 1, nativeInvalid: 0, submits: 0 });

  // a VALID host submits — the hidden native (empty-looking, required) can no
  // longer block the form independently of the host
  await page.evaluate(() => {
    document.getElementById('h1sel').value = 'a';
    document.getElementById('h1form').requestSubmit();
  });
  expect(await page.evaluate(() => window.__h1)).toEqual({ hostInvalid: 1, nativeInvalid: 0, submits: 1 });
  // host→native selectedIndex sync still works on the disabled native
  expect(await page.evaluate(() => document.getElementById('h1native').selectedIndex)).toBe(1);

  // ordering hazard: a re-adoption (option-list mutation) must not misread OUR
  // forced disabled as the author's — the host stays enabled
  const r = await page.evaluate(async () => {
    const o = document.createElement('option');
    o.value = 'c';
    o.text = 'Gamma';
    document.getElementById('h1native').append(o);
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    const host = document.getElementById('h1sel');
    return {
      length: host.length,
      hostDisabled: host.hasAttribute('disabled'),
      triggerDisabled: host.shadowRoot.querySelector('button').disabled,
      value: host.value, // dirty (programmatic write) → preserved across re-adoption
    };
  });
  expect(r).toEqual({ length: 4, hostDisabled: false, triggerDisabled: false, value: 'a' });
});

test('wrapped-native: forwarded attributes are host-owned after upgrade — removal survives re-adoption and reset', async ({ page }) => {
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'k1form';
    const host = document.createElement('mythical-select');
    host.id = 'k1sel';
    const sel = document.createElement('select');
    sel.id = 'k1native';
    sel.setAttribute('name', 'k1');
    sel.setAttribute('required', '');
    sel.setAttribute('disabled', ''); // the AUTHOR disabled the native
    for (const [v, t] of [['', 'Choose…'], ['a', 'Alpha']]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = t;
      sel.append(o);
    }
    host.append(sel);
    form.append(host);
    document.body.append(form);
  });
  // first sight of the native (the upgrade) forwards name/required/disabled
  expect(await page.evaluate(() => {
    const host = document.getElementById('k1sel');
    return {
      name: host.getAttribute('name'),
      required: host.hasAttribute('required'),
      disabled: host.hasAttribute('disabled'),
    };
  })).toEqual({ name: 'k1', required: true, disabled: true });
  // the consumer CLEARS the forwarded attributes — host-owned from here on:
  // neither an option mutation (re-adoption) nor a form reset re-imposes them
  const r = await page.evaluate(async () => {
    const host = document.getElementById('k1sel');
    host.removeAttribute('required');
    host.removeAttribute('disabled');
    const o = document.createElement('option');
    o.value = 'b';
    o.text = 'Beta';
    document.getElementById('k1native').append(o); // option mutation → re-adoption
    await new Promise((res) => setTimeout(res, 0));
    const afterMutation = {
      required: host.hasAttribute('required'),
      disabled: host.hasAttribute('disabled'),
      length: host.length,
    };
    document.getElementById('k1form').reset(); // formResetCallback re-adopts too
    await new Promise((res) => setTimeout(res, 0));
    const afterReset = { required: host.hasAttribute('required'), disabled: host.hasAttribute('disabled') };
    return { afterMutation, afterReset };
  });
  expect(r.afterMutation).toEqual({ required: false, disabled: false, length: 3 });
  expect(r.afterReset).toEqual({ required: false, disabled: false });
});

test('wrapped-native: the form attribute forwards — external form association survives the upgrade', async ({ page }) => {
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'xf';
    document.body.append(form);
    const host = document.createElement('mythical-select');
    host.id = 'xfsel';
    const sel = document.createElement('select');
    sel.id = 'xfnative';
    sel.setAttribute('name', 'xw');
    sel.setAttribute('form', 'xf'); // associated with #xf from OUTSIDE it
    for (const v of ['a', 'b']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel);
    document.body.append(host); // upgrade — the host must inherit the association
  });
  // FACE honors the form content attribute: the host's entry lands in THAT form
  expect(await page.evaluate(() => {
    const host = document.getElementById('xfsel');
    return {
      attr: host.getAttribute('form'),
      associated: host.form === document.getElementById('xf'),
      entry: new FormData(document.getElementById('xf')).get('xw'),
    };
  })).toEqual({ attr: 'xf', associated: true, entry: 'a' });
  // host-owned after the forward: clearing it is NOT re-imposed by a re-adoption
  const cleared = await page.evaluate(async () => {
    const host = document.getElementById('xfsel');
    host.removeAttribute('form');
    const o = document.createElement('option');
    o.value = 'c';
    o.text = 'c';
    document.getElementById('xfnative').append(o); // option mutation → re-adoption
    await new Promise((res) => setTimeout(res, 0));
    return {
      attr: host.getAttribute('form'),
      length: host.length,
      hasEntry: new FormData(document.getElementById('xf')).has('xw'),
    };
  });
  expect(cleared).toEqual({ attr: null, length: 3, hasEntry: false });
});

test('wrapped-native: labels targeting the INNER select join the mirrored accessible name', async ({ page }) => {
  await page.evaluate(() => {
    // progressive markup commonly labels the INNER select (<label for> + its id)
    // — after upgrade that label is orphaned unless the host mirrors it too
    const mk = (hostId, withHostLabel) => {
      if (withHostLabel) {
        const hl = document.createElement('label');
        hl.setAttribute('for', hostId);
        hl.textContent = 'Region';
        document.body.append(hl);
      }
      const nl = document.createElement('label');
      nl.setAttribute('for', `${hostId}-native`);
      nl.textContent = 'Country';
      const host = document.createElement('mythical-select');
      host.id = hostId;
      const sel = document.createElement('select');
      sel.id = `${hostId}-native`;
      sel.name = hostId;
      for (const v of ['dk', 'se']) {
        const o = document.createElement('option');
        o.value = v;
        o.text = v;
        sel.append(o);
      }
      host.append(sel);
      document.body.append(nl, host);
    };
    mk('inl1', false); // native-targeting label ONLY
    mk('inl2', true); // host-targeting AND native-targeting labels
  });
  const name = (id) => page.evaluate((hostId) =>
    document.getElementById(hostId).shadowRoot.querySelector('button').getAttribute('aria-label'), id);
  // the inner label's text reaches the trigger's accessible name
  await expect.poll(() => name('inl1')).toBe('Country');
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toHaveCount(1);
  // host-targeting labels come FIRST, then the native-targeting ones
  await expect.poll(() => name('inl2')).toBe('Region Country');
});

test('wrapped-native: clicking an inner-native label focuses the trigger; departure rewires it to the restored native', async ({ page }) => {
  await page.evaluate(() => {
    const label = document.createElement('label');
    label.id = 'br-label';
    label.setAttribute('for', 'br-native');
    label.textContent = 'Country';
    const host = document.createElement('mythical-select');
    host.id = 'br-host';
    const sel = document.createElement('select');
    sel.id = 'br-native';
    sel.name = 'br';
    for (const v of ['dk', 'se']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel);
    document.body.append(label, host);
  });
  // adopted: the label's own activation targets the force-DISABLED native and
  // goes nowhere — the activation bridge focuses the host's trigger instead.
  // (force: Playwright derives a label's enabled-ness from its for-target, and
  // the adopted native is disabled — actionability would refuse the click; the
  // dispatched input events are still real)
  await page.locator('#br-label').click({ force: true });
  await expect.poll(() => page.evaluate(() => {
    const host = document.getElementById('br-host');
    return document.activeElement === host &&
      host.shadowRoot.activeElement === host.shadowRoot.querySelector('button');
  })).toBe(true);
  // native parity: a label click focuses, it never opens the picker
  await expect(page.locator('#br-host button')).toHaveAttribute('aria-expanded', 'false');
  // …and the trigger carries the inner label's text while adopted
  expect(await page.evaluate(() =>
    document.getElementById('br-host').shadowRoot.querySelector('button').getAttribute('aria-label'))).toBe('Country');
  // disabled host: the bridge must NOT focus the trigger
  await page.evaluate(() => {
    document.getElementById('submit').focus(); // park focus elsewhere first
    document.getElementById('br-host').setAttribute('disabled', '');
  });
  await page.locator('#br-label').click({ force: true }); // for-target still disabled
  expect(await page.evaluate(() =>
    document.activeElement === document.getElementById('br-host'))).toBe(false);
  await page.evaluate(() => document.getElementById('br-host').removeAttribute('disabled'));
  // the native departs → presentation restored, bridge unbound, name updated
  await page.evaluate(() => document.body.append(document.getElementById('br-native')));
  await expect.poll(() => page.evaluate(() => {
    const sel = document.getElementById('br-native');
    return !sel.disabled && sel.style.display === '';
  })).toBe(true);
  expect(await page.evaluate(() =>
    document.getElementById('br-host').shadowRoot.querySelector('button').getAttribute('aria-label'))).toBe(null);
  // the label goes back to focusing the restored NATIVE (probed: a label click
  // focuses a plain native select in all three engines), not the host's trigger
  await page.locator('#br-label').click();
  await expect.poll(() => page.evaluate(() => ({
    nativeFocused: document.activeElement === document.getElementById('br-native'),
    hostFocused: document.activeElement === document.getElementById('br-host'),
  }))).toEqual({ nativeFocused: true, hostFocused: false });
});

test('wrapped-native: a label added AFTER adoption both names and focuses the trigger (delegated bridge)', async ({ page }) => {
  await page.evaluate(() => {
    const host = document.createElement('mythical-select');
    host.id = 'late-host';
    const sel = document.createElement('select');
    sel.id = 'late-nat';
    sel.name = 'late-br';
    for (const v of ['dk', 'se']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel);
    document.body.append(host); // upgrade happens with NO label in sight
  });
  // unnamed so far — adoption saw no labels
  expect(await page.evaluate(() =>
    document.getElementById('late-host').shadowRoot.querySelector('button').getAttribute('aria-label'))).toBe(null);
  // the label arrives AFTER adoption — per-label binding at adoption would miss it
  await page.evaluate(() => {
    const label = document.createElement('label');
    label.id = 'late-label';
    label.setAttribute('for', 'late-nat');
    label.textContent = 'Late country';
    document.body.append(label);
  });
  // (force: the label's for-target is the force-disabled adopted native —
  // Playwright actionability would refuse the click; the events are still real)
  await page.locator('#late-label').click({ force: true });
  await expect.poll(() => page.evaluate(() => {
    const host = document.getElementById('late-host');
    return document.activeElement === host &&
      host.shadowRoot.activeElement === host.shadowRoot.querySelector('button');
  })).toBe(true);
  // …and the focusin refresh mirrors the late label's text as the name
  expect(await page.evaluate(() =>
    document.getElementById('late-host').shadowRoot.querySelector('button').getAttribute('aria-label'))).toBe('Late country');
});

test('wrapped-native: clicks on interactive content INSIDE the label do not bridge to the trigger', async ({ page }) => {
  await page.evaluate(() => {
    // HTML label activation does not fire for clicks on interactive content
    // inside the label — a nested link keeps its own behavior, so the bridge
    // must not steal focus onto the trigger for it
    const label = document.createElement('label');
    label.id = 'ib-label';
    label.setAttribute('for', 'ib-native');
    const plain = document.createElement('span');
    plain.id = 'ib-plain';
    plain.textContent = 'Country';
    const link = document.createElement('a');
    link.id = 'ib-link';
    link.href = '#ib-help';
    link.textContent = 'help';
    link.addEventListener('click', (e) => e.preventDefault()); // keep the page put
    label.append(plain, ' ', link);
    const host = document.createElement('mythical-select');
    host.id = 'ib-host';
    const sel = document.createElement('select');
    sel.id = 'ib-native';
    sel.name = 'ib';
    for (const v of ['dk', 'se']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      sel.append(o);
    }
    host.append(sel);
    document.body.append(label, host);
    document.getElementById('submit').focus(); // park focus away from the host
  });
  await page.locator('#ib-link').click(); // the LINK — interactive content
  expect(await page.evaluate(() =>
    document.activeElement === document.getElementById('ib-host'))).toBe(false);
  // …while the label's PLAIN text keeps bridging (force: the label's
  // for-target is the force-disabled adopted native — Playwright
  // actionability would refuse the click; the dispatched events are still real)
  await page.locator('#ib-plain').click({ force: true });
  await expect.poll(() => page.evaluate(() => {
    const host = document.getElementById('ib-host');
    return document.activeElement === host &&
      host.shadowRoot.activeElement === host.shadowRoot.querySelector('button');
  })).toBe(true);
});

/* --------------------------------------------------------- option mutations */

/** Create a plain dynamic instance with options a/b/c for mutation tests. */
async function makeMutable(page) {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'mut';
    el.setAttribute('name', 'mut');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row'], ['c', 'charlie row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
  });
}

test('mutations: appending an option shows up (MutationObserver)', async ({ page }) => {
  await makeMutable(page);
  await page.evaluate(() => {
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'd');
    o.textContent = 'delta row';
    document.getElementById('mut').append(o);
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('mut').length)).toBe(4);
  const r = await page.evaluate(() => {
    const el = document.getElementById('mut');
    return {
      last: el.item(3),
      rendered: el.shadowRoot.querySelectorAll('.opt').length,
      value: el.value, // selection kept
    };
  });
  expect(r.last).toMatchObject({ value: 'd', text: 'delta row', index: 3 });
  expect(r.rendered).toBe(4);
  expect(r.value).toBe('a');
});

test('mutations: disabling an option makes keyboard nav skip it', async ({ page }) => {
  await makeMutable(page);
  await page.evaluate(() => {
    document.getElementById('mut').children[1].setAttribute('disabled', ''); // "b"
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('mut').item(1).disabled)).toBe(true);
  const btn = page.locator('#mut button');
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // open at o0 (selection)
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o0');
  await page.keyboard.press('ArrowDown'); // o1 disabled → skip to o2
  await expect(btn).toHaveAttribute('aria-activedescendant', 'o2');
});

test('mutations: removing the selected option resets to the native default (first non-disabled)', async ({ page }) => {
  await makeMutable(page);
  const r = await page.evaluate(async () => {
    // self-documentation: a REAL native select, same shape, same operations —
    // the host assertion below must match whatever this engine's own <select>
    // does (it resets to the default; it does not jump by value or index)
    const nat = document.createElement('select');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      nat.append(o);
    }
    document.body.append(nat);
    nat.value = 'b';
    nat.options[1].remove();
    const el = document.getElementById('mut');
    el.value = 'b'; // programmatic — no events, selection at index 1
    el.children[1].remove(); // the selected option vanishes
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: { value: el.value, selectedIndex: el.selectedIndex, length: el.length },
    };
  });
  // native resets to the FIRST NON-DISABLED option ("a"), NOT the surviving
  // index 1 ("c") and NOT a value match — the host replicates it
  expect(r.native).toEqual({ value: 'a', selectedIndex: 0 });
  expect(r.host).toEqual({ value: 'a', selectedIndex: 0, length: 2 });
});

test('mutations: removal reset ignores [selected] carriers on the remaining options', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference: defaultSelected does NOT re-enter the reset — removing
    // the selected option lands on the first non-disabled, not the [selected] one
    const nat = document.createElement('select');
    for (const [v, selAttr] of [['a', false], ['b', false], ['c', true]]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      if (selAttr) o.setAttribute('selected', '');
      nat.append(o);
    }
    document.body.append(nat);
    nat.value = 'b'; // dirty
    nat.options[1].remove();
    const el = document.createElement('mythical-select');
    el.innerHTML = '<mythical-option value="a">a</mythical-option>' +
      '<mythical-option value="b">b</mythical-option>' +
      '<mythical-option value="c" selected>c</mythical-option>';
    document.body.append(el);
    el.value = 'b'; // dirty
    el.children[1].remove();
    await new Promise((res) => setTimeout(res, 0));
    const out = {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: { value: el.value, selectedIndex: el.selectedIndex },
    };
    nat.remove(); el.remove();
    return out;
  });
  expect(r.native).toEqual({ value: 'a', selectedIndex: 0 });
  expect(r.host).toEqual({ value: 'a', selectedIndex: 0 });
});

test('mutations: the defaults scan skips disabled options; all-disabled → no selection', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mkNative = (rows) => {
      const s = document.createElement('select');
      for (const [v, dis] of rows) {
        const o = document.createElement('option');
        o.value = v;
        o.text = v;
        if (dis) o.setAttribute('disabled', '');
        s.append(o);
      }
      document.body.append(s);
      return s;
    };
    const mkHost = (id, rows) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', id);
      for (const [v, dis] of rows) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        if (dis) o.setAttribute('disabled', '');
        o.textContent = v;
        el.append(o);
      }
      document.body.append(el);
      return el;
    };
    // (1) selected option removed while the FIRST remaining option is disabled:
    // native picks the first NON-disabled option ("c"), skipping "a"
    const rows1 = [['a', true], ['b', false], ['c', false]];
    const nat1 = mkNative(rows1);
    nat1.value = 'b';
    nat1.options[1].remove();
    const el1 = mkHost('k3-dis', rows1);
    el1.value = 'b';
    el1.children[1].remove();
    // (2) EVERY option disabled from the start: the engines disagree here —
    // Chromium and Firefox select nothing (selectedIndex -1, the spec's
    // "first option … that is not disabled, IF ANY"), WebKit alone selects
    // the first option anyway. The host follows the spec majority on ALL
    // engines, so it is asserted as a constant, not against this engine.
    const el2 = mkHost('k3-all', [['x', true], ['y', true]]);
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      native: { value: nat1.value, selectedIndex: nat1.selectedIndex },
      host: { value: el1.value, selectedIndex: el1.selectedIndex },
      allDisabled: { value: el2.value, selectedIndex: el2.selectedIndex, length: el2.length },
    };
  });
  expect(r.native).toEqual({ value: 'c', selectedIndex: 1 }); // self-documentation
  expect(r.host).toEqual({ value: 'c', selectedIndex: 1 });
  expect(r.allDisabled).toEqual({ value: '', selectedIndex: -1, length: 2 });
});

test('mutations: dirty no-selection (selectedIndex -1) survives option METADATA mutations (native parity)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference: metadata-only mutations (disabling an unrelated option,
    // editing option text) while selectedIndex is -1 leave the native at -1 —
    // only MEMBERSHIP changes re-run the ask-for-reset (probed, see next test)
    const nat = document.createElement('select');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      nat.append(o);
    }
    document.body.append(nat);
    nat.selectedIndex = -1; // valid programmatic no-selection
    nat.options[1].setAttribute('disabled', '');
    nat.options[2].firstChild.data = 'sea';
    const el = document.createElement('mythical-select');
    el.id = 'none1';
    el.setAttribute('name', 'none1');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
    el.selectedIndex = -1; // dirty + no selection
    el.children[1].setAttribute('disabled', ''); // attribute metadata → re-adoption
    await new Promise((res) => setTimeout(res, 0));
    const afterAttr = { value: el.value, selectedIndex: el.selectedIndex };
    el.children[2].firstChild.data = 'sea'; // characterData metadata → re-adoption
    await new Promise((res) => setTimeout(res, 0));
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      afterAttr,
      host: { value: el.value, selectedIndex: el.selectedIndex, disabled1: el.item(1).disabled, label2: el.item(2).label },
    };
  });
  expect(r.native).toEqual({ value: '', selectedIndex: -1 }); // self-documentation
  expect(r.afterAttr).toEqual({ value: '', selectedIndex: -1 });
  expect(r.host).toEqual({ value: '', selectedIndex: -1, disabled1: true, label2: 'sea' });
});

test('mutations: dirty no-selection survives a textContent write (text-only childList record = metadata)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference: opt.textContent = 'x' REPLACES the text node — a
    // childList mutation — yet membership did not change: native stays at -1
    // (.data writes take the characterData record path instead — both paths
    // are covered, see the METADATA test above)
    const nat = document.createElement('select');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      nat.append(o);
    }
    document.body.append(nat);
    nat.selectedIndex = -1; // valid programmatic no-selection
    nat.options[1].textContent = 'bravo two';
    const el = document.createElement('mythical-select');
    el.id = 'txt1';
    el.setAttribute('name', 'txt1');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('mythical-option');
      o.textContent = v; // no value attributes — values derive from the text
      el.append(o);
    }
    document.body.append(el);
    el.selectedIndex = -1; // dirty + no selection
    el.children[1].textContent = 'bravo two'; // childList record, text nodes only
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: {
        value: el.value,
        selectedIndex: el.selectedIndex,
        // the option's label AND implicit value still update off the new text
        opt1: { value: el.item(1).value, label: el.item(1).label },
      },
    };
  });
  expect(r.native).toEqual({ value: '', selectedIndex: -1 }); // self-documentation
  expect(r.host).toEqual({
    value: '', selectedIndex: -1,
    opt1: { value: 'bravo two', label: 'bravo two' },
  });
});

test('mutations: markup added INSIDE an option is metadata — dirty no-selection kept, label refreshed', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference: appending an inline <span> INSIDE an option while
    // selectedIndex is -1 refreshes the option's text but does not change
    // option MEMBERSHIP — native stays at -1
    const nat = document.createElement('select');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      nat.append(o);
    }
    document.body.append(nat);
    nat.selectedIndex = -1; // valid programmatic no-selection
    const ns = document.createElement('span');
    ns.textContent = ' two';
    nat.options[1].append(ns);
    const el = document.createElement('mythical-select');
    el.id = 'inm1';
    el.setAttribute('name', 'inm1');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('mythical-option');
      o.textContent = v; // no value attributes — implicit values from the text
      el.append(o);
    }
    document.body.append(el);
    el.selectedIndex = -1; // dirty + no selection
    const hs = document.createElement('span');
    hs.textContent = ' two';
    el.children[1].append(hs); // ELEMENT added INSIDE an adopted option → metadata
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: {
        value: el.value,
        selectedIndex: el.selectedIndex,
        // …while the option's label and implicit value refresh off the new content
        opt1: { value: el.item(1).value, label: el.item(1).label },
        row1: el.shadowRoot.querySelector('#o1 span').textContent,
      },
    };
  });
  expect(r.native).toEqual({ value: '', selectedIndex: -1 }); // self-documentation
  expect(r.host).toEqual({
    value: '', selectedIndex: -1,
    opt1: { value: 'b two', label: 'b two' },
    row1: 'b two',
  });
});

test('mutations: a [selected]-attributed NON-option node is not a selectedness carrier', async ({ page }) => {
  await makeMutable(page);
  const r = await page.evaluate(async () => {
    const el = document.getElementById('mut');
    el.value = 'c'; // programmatic write → dirty
    const s = document.createElement('span');
    s.setAttribute('selected', ''); // [selected] on a NON-option node
    s.textContent = 'not an option';
    el.append(s); // added at select level → 'structural', never 'force'
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  // 'force' would skip preservation and re-run the defaults scan (no
  // [selected] OPTION anywhere → first enabled, "a"); structural preserves
  // the dirty pick by source-element identity — and the span never becomes
  // an option
  expect(r).toEqual({ value: 'c', selectedIndex: 2, length: 3 });
});

test('mutations: dirty no-selection + a STRUCTURAL mutation resets to the first enabled option (native parity)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference (probe outcome, unanimous on chromium + firefox +
    // webkit): appending OR removing an option while selectedIndex is -1
    // re-runs the spec's ask-for-reset and selects the first enabled option —
    // a dirty no-selection does NOT survive membership changes
    const mkNat = () => {
      const s = document.createElement('select');
      for (const v of ['a', 'b', 'c']) {
        const o = document.createElement('option');
        o.value = v;
        o.text = v;
        s.append(o);
      }
      document.body.append(s);
      s.selectedIndex = -1;
      return s;
    };
    const natAppend = mkNat();
    const no = document.createElement('option');
    no.value = 'd';
    no.text = 'd';
    natAppend.append(no);
    const natRemove = mkNat();
    natRemove.options[1].remove();
    const mkHost = (id) => {
      const el = document.createElement('mythical-select');
      el.id = id;
      el.setAttribute('name', id);
      for (const v of ['a', 'b', 'c']) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = v;
        el.append(o);
      }
      document.body.append(el);
      el.selectedIndex = -1; // dirty + no selection
      return el;
    };
    const hostAppend = mkHost('none2a');
    const ho = document.createElement('mythical-option');
    ho.setAttribute('value', 'd');
    ho.textContent = 'd';
    hostAppend.append(ho);
    const hostRemove = mkHost('none2b');
    hostRemove.children[1].remove();
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoptions run
    return {
      natives: {
        append: { value: natAppend.value, selectedIndex: natAppend.selectedIndex },
        remove: { value: natRemove.value, selectedIndex: natRemove.selectedIndex },
      },
      hosts: {
        append: { value: hostAppend.value, selectedIndex: hostAppend.selectedIndex, length: hostAppend.length },
        remove: { value: hostRemove.value, selectedIndex: hostRemove.selectedIndex, length: hostRemove.length },
      },
    };
  });
  expect(r.natives.append).toEqual({ value: 'a', selectedIndex: 0 }); // self-documentation
  expect(r.natives.remove).toEqual({ value: 'a', selectedIndex: 0 });
  expect(r.hosts.append).toEqual({ value: 'a', selectedIndex: 0, length: 4 });
  expect(r.hosts.remove).toEqual({ value: 'a', selectedIndex: 0, length: 2 });
});

test('mutations: duplicate values — the selected SOURCE ELEMENT wins on re-adoption', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'dup';
    el.setAttribute('name', 'dup');
    for (const [v, t] of [['solo', 'solo row'], ['dup', 'first dup'], ['dup', 'second dup']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    document.body.append(el);
    el.selectedIndex = 2; // the SECOND "dup"
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'extra');
    o.textContent = 'extra row';
    el.children[2].before(o); // insert BEFORE the selected duplicate → re-adoption
  });
  // first-value-match would snap to index 1 ("first dup"), index-identity to the
  // inserted option — SOURCE-ELEMENT identity must follow "second dup" to index 3
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('dup');
    return {
      length: el.length,
      selectedIndex: el.selectedIndex,
      value: el.value,
      label: el.shadowRoot.querySelector('#label').textContent,
    };
  })).toEqual({ length: 4, selectedIndex: 3, value: 'dup', label: 'second dup' });
});

test('mutations: host value-attribute mutations do NOT re-adopt (no revert of a no-match clear)', async ({ page }) => {
  await makeMutable(page);
  const r = await page.evaluate(async () => {
    const el = document.getElementById('mut');
    el.setAttribute('value', 'missing'); // attributeChangedCallback: no match → clears
    const cleared = { value: el.value, selectedIndex: el.selectedIndex };
    await new Promise((res) => setTimeout(res, 0)); // macrotask: any observer reaction ran
    const settled = { value: el.value, selectedIndex: el.selectedIndex, attr: el.getAttribute('value') };
    return { cleared, settled };
  });
  expect(r.cleared).toEqual({ value: '', selectedIndex: -1 });
  // the MutationObserver must NOT revert to the [selected]/first default while
  // the attribute still says 'missing' — host attrs belong to attributeChangedCallback
  expect(r.settled).toEqual({ value: '', selectedIndex: -1, attr: 'missing' });
});

test('mutations: pristine control — a purely structural insert keeps the implicit selection (identity)', async ({ page }) => {
  await makeMutable(page); // pristine: no [selected], no commits, no writes → implicit "a"
  await page.evaluate(() => {
    const el = document.getElementById('mut');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'z');
    o.textContent = 'zulu row';
    el.children[0].before(o); // insert BEFORE the implicitly-selected first option
  });
  // no record touched a `selected` attribute → defaults are NOT re-run: native
  // keeps selectedness on the original NODE — the newcomer must not steal it
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('mut');
    return { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  })).toEqual({ value: 'a', selectedIndex: 1, length: 4 });
});

test('mutations: pristine control — a [selected] default added later moves the selection', async ({ page }) => {
  await makeMutable(page);
  await page.evaluate(() => {
    document.getElementById('mut').children[1].setAttribute('selected', ''); // "b"
  });
  // no commit, no programmatic write → native defaultSelected semantics: it moves
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('mut');
    return { value: el.value, selectedIndex: el.selectedIndex };
  })).toEqual({ value: 'b', selectedIndex: 1 });
});

test('mutations: after a user commit, a [selected] default added to ANOTHER option still moves the selection (per-option dirtiness)', async ({ page }) => {
  // A user commit dirties ONLY the option it selects. A [selected] default
  // added later to a DIFFERENT, still-pristine option therefore selects that
  // option — the commit does not freeze the whole control. Verified against a
  // real <select> driven by a real user commit (selectOption).
  await makeMutable(page);
  await page.evaluate(() => {
    const s = document.createElement('select');
    s.id = 'uc-ref';
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v; o.text = v;
      s.append(o);
    }
    document.body.append(s);
  });
  await page.selectOption('#uc-ref', 'c'); // REAL user commit on the native reference
  await page.locator('#mut button').click();
  await page.locator('#mut .opt[data-i="2"]').click(); // REAL user commit on the host → "charlie row"
  const r = await page.evaluate(async () => {
    const el = document.getElementById('mut');
    const nat = document.getElementById('uc-ref');
    const committed = { native: nat.value, host: el.value };
    nat.options[1].setAttribute('selected', ''); // [selected] onto pristine "b"
    el.children[1].setAttribute('selected', '');
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      committed,
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: { value: el.value, selectedIndex: el.selectedIndex },
    };
  });
  expect(r.committed).toEqual({ native: 'c', host: 'c' }); // both committed to "c"
  expect(r.native).toEqual({ value: 'b', selectedIndex: 1 }); // self-documentation — unanimous
  expect(r.host).toEqual(r.native); // native-differential
  // (the index-0 divergence is covered by the next test)
});

test('mutations: a [selected] default added to the FIRST option after a commit — Firefox deviates, we follow the majority', async ({ page, browserName }) => {
  // Same shape as the test above but targeting index 0. Chromium and WebKit
  // select "a" (consistent with their own behavior at every other index, and
  // with the spec: the attribute writes selectedness on a non-dirty option, and
  // a single select deselects the rest). FIREFOX alone ignores a [selected] add
  // on index 0 while another option is selected — a Gecko quirk that is
  // self-inconsistent (Firefox DOES honor it at index 1 and 2, see the test
  // above). The host follows the 2-engine majority on ALL engines, so it is
  // asserted as a constant — same precedent as the all-disabled → -1 decline.
  await makeMutable(page);
  await page.locator('#mut button').click();
  await page.locator('#mut .opt[data-i="2"]').click(); // user commit → "charlie row"
  const r = await page.evaluate(async () => {
    const nat = document.createElement('select');
    for (const v of ['a', 'b', 'c']) {
      const o = document.createElement('option');
      o.value = v; o.text = v;
      nat.append(o);
    }
    document.body.append(nat);
    nat.value = 'c'; // dirties only "c"
    nat.options[0].setAttribute('selected', ''); // [selected] onto pristine "a"
    const el = document.getElementById('mut');
    el.children[0].setAttribute('selected', '');
    await new Promise((res) => setTimeout(res, 0));
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: { value: el.value, selectedIndex: el.selectedIndex },
    };
  });
  expect(r.host).toEqual({ value: 'a', selectedIndex: 0 }); // majority behavior, all engines
  if (browserName === 'firefox') expect(r.native).toEqual({ value: 'c', selectedIndex: 2 }); // documented deviation
  else expect(r.native).toEqual(r.host); // native-differential on chromium + webkit
});

test('mutations: an INSERTED [selected] carrier beats dirtiness after a user commit (native parity)', async ({ page }) => {
  await makeMutable(page);
  await page.locator('#mut button').click();
  await page.locator('#mut .opt[data-i="2"]').click(); // user commit → dirty ("charlie row")
  const r = await page.evaluate(async () => {
    const el = document.getElementById('mut');
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'z');
    o.setAttribute('selected', '');
    o.textContent = 'zulu row';
    el.append(o); // the INSERTED node CARRIES selectedness — dirtiness only guards
    await new Promise((res) => setTimeout(res, 0)); // attribute CHANGES on existing options
    return { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  expect(r).toEqual({ value: 'z', selectedIndex: 3, length: 4 });
});

test('mutations: an INSERTED [selected] carrier beats dirtiness after a selectedIndex write', async ({ page }) => {
  await makeMutable(page);
  const r = await page.evaluate(async () => {
    const el = document.getElementById('mut');
    el.selectedIndex = 1; // programmatic write → dirty
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'z');
    o.setAttribute('selected', '');
    o.textContent = 'zulu row';
    el.append(o); // carrier insertion → the carrier wins anyway
    await new Promise((res) => setTimeout(res, 0));
    return { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  expect(r).toEqual({ value: 'z', selectedIndex: 3, length: 4 });
});

test('mutations: reordering an already-adopted [selected] option keeps the current pick (moved ≠ new carrier)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // native reference: selectedness lives on the NODE — re-inserting a
    // defaultSelected option whose live selectedness is false triggers nothing,
    // so the user's pick survives the reorder
    const nat = document.createElement('select');
    for (const [v, s] of [['a', true], ['b', false], ['c', false]]) {
      const o = document.createElement('option');
      o.value = v;
      o.text = v;
      if (s) o.setAttribute('selected', '');
      nat.append(o);
    }
    document.body.append(nat);
    nat.value = 'b'; // the pick
    nat.append(nat.options[0]); // move defaultSelected "a" to the END
    const el = document.createElement('mythical-select');
    el.id = 'mv';
    el.setAttribute('name', 'mv');
    for (const [v, s] of [['a', true], ['b', false], ['c', false]]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      if (s) o.setAttribute('selected', '');
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
    el.value = 'b'; // dirty — the pick a 'force' reorder would wrongly yank
    el.append(el.children[0]); // move the [selected] option to the END
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      native: { value: nat.value, selectedIndex: nat.selectedIndex },
      host: { value: el.value, selectedIndex: el.selectedIndex, length: el.length },
    };
  });
  expect(r.native).toEqual({ value: 'b', selectedIndex: 0 }); // self-documentation
  expect(r.host).toEqual({ value: 'b', selectedIndex: 0, length: 3 });
});

/* ---- per-OPTION selectedness/dirtiness (the HTML model) -------------------
   Native tracks selection PER OPTION, never select-wide: every option has a
   selectedness AND a dirtiness; the [selected] CONTENT ATTRIBUTE writes
   selectedness only while THAT option's dirtiness is false; a user commit or a
   value/selectedIndex write dirties ONLY the option it selects; and structural
   mutations run the spec's ask-for-reset. The three tests below pin the
   consequences a select-wide dirty flag got wrong. */

test('mutations: dirtiness is PER OPTION — a [selected] default added later beats an earlier value/selectedIndex write', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mkNat = (rows) => {
      const s = document.createElement('select');
      for (const [v, sel] of rows) {
        const o = document.createElement('option');
        o.value = v; o.text = v;
        if (sel) o.setAttribute('selected', '');
        s.append(o);
      }
      document.body.append(s);
      return s;
    };
    const mkHost = (id, rows) => {
      const el = document.createElement('mythical-select');
      el.id = id; el.setAttribute('name', id);
      for (const [v, sel] of rows) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        if (sel) o.setAttribute('selected', '');
        o.textContent = v;
        el.append(o);
      }
      document.body.append(el);
      return el;
    };
    const st = (x) => ({ value: x.value, selectedIndex: x.selectedIndex });
    // native reference: `value = 'c'` dirties ONLY "c", so adding [selected] to
    // the still-pristine "b" selects b and deselects c — the default is not
    // suppressed by an unrelated option's dirtiness. Unanimous on all three
    // engines for a non-first option (see the index-0 note in the user-commit
    // test below).
    const natV = mkNat([['a'], ['b'], ['c']]);
    natV.value = 'c';
    natV.options[1].setAttribute('selected', '');
    const natI = mkNat([['a'], ['b'], ['c']]);
    natI.selectedIndex = 2;
    natI.options[1].setAttribute('selected', '');
    // hosts — identical shape, identical operations
    const elV = mkHost('po-v', [['a'], ['b'], ['c']]);
    elV.value = 'c';
    elV.children[1].setAttribute('selected', '');
    const elI = mkHost('po-i', [['a'], ['b'], ['c']]);
    elI.selectedIndex = 2;
    elI.children[1].setAttribute('selected', '');
    await new Promise((res) => setTimeout(res, 0)); // let the re-adoption run
    return {
      nativeValue: st(natV), hostValue: st(elV),
      nativeIndex: st(natI), hostIndex: st(elI),
    };
  });
  expect(r.nativeValue).toEqual({ value: 'b', selectedIndex: 1 }); // self-documentation
  expect(r.nativeIndex).toEqual({ value: 'b', selectedIndex: 1 });
  expect(r.hostValue).toEqual(r.nativeValue); // native-differential
  expect(r.hostIndex).toEqual(r.nativeIndex);
});

test('mutations: after selectedIndex = -1 an appended option ask-for-resets to the first enabled — no [selected] resurrection', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mkNat = (rows) => {
      const s = document.createElement('select');
      for (const [v, sel] of rows) {
        const o = document.createElement('option');
        o.value = v; o.text = v;
        if (sel) o.setAttribute('selected', '');
        s.append(o);
      }
      document.body.append(s);
      return s;
    };
    const mkHost = (id, rows) => {
      const el = document.createElement('mythical-select');
      el.id = id; el.setAttribute('name', id);
      for (const [v, sel] of rows) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        if (sel) o.setAttribute('selected', '');
        o.textContent = v;
        el.append(o);
      }
      document.body.append(el);
      return el;
    };
    const st = (x) => ({ value: x.value, selectedIndex: x.selectedIndex });
    // native reference: clearing the selection leaves "c" with selectedness
    // FALSE even though it still carries [selected] — the attribute is only a
    // default, and the ask-for-reset an appended option triggers picks the
    // first ENABLED option ("a"). It does NOT replay c's [selected].
    const nat = mkNat([['a'], ['b'], ['c', true]]);
    nat.selectedIndex = -1;
    const no = document.createElement('option');
    no.value = 'd'; no.text = 'd';
    nat.append(no); // a plain, UNSELECTED option
    const el = mkHost('po-r', [['a'], ['b'], ['c', true]]);
    el.selectedIndex = -1;
    const ho = document.createElement('mythical-option');
    ho.setAttribute('value', 'd'); ho.textContent = 'd';
    el.append(ho);
    await new Promise((res) => setTimeout(res, 0));
    return { native: st(nat), host: { ...st(el), length: el.length } };
  });
  expect(r.native).toEqual({ value: 'a', selectedIndex: 0 }); // self-documentation
  expect(r.host).toEqual({ value: 'a', selectedIndex: 0, length: 4 }); // native-differential
});

test('mutations: a MOVE after selectedIndex = -1 resets on the REMOVAL, before the re-insertion', async ({ page, browserName }) => {
  const r = await page.evaluate(async () => {
    const mkNat = (rows) => {
      const s = document.createElement('select');
      for (const [v] of rows) {
        const o = document.createElement('option');
        o.value = v; o.text = v;
        s.append(o);
      }
      document.body.append(s);
      return s;
    };
    const mkHost = (id, rows) => {
      const el = document.createElement('mythical-select');
      el.id = id; el.setAttribute('name', id);
      for (const [v] of rows) {
        const o = document.createElement('mythical-option');
        o.setAttribute('value', v);
        o.textContent = v;
        el.append(o);
      }
      document.body.append(el);
      return el;
    };
    const st = (x) => ({ value: x.value, selectedIndex: x.selectedIndex });
    // A reorder is a removal PLUS an insertion. With nothing selected, the
    // REMOVAL's ask-for-reset lands on the first enabled option of the list AS
    // IT IS AT THAT MOMENT ("a", with b lifted out) and the re-insertion then
    // finds a selection already made — so "a" stays selected at its NEW index.
    // Resolving against the final tree instead would wrongly pick "b".
    const nat = mkNat([['a'], ['b'], ['c']]);
    nat.selectedIndex = -1;
    nat.insertBefore(nat.options[1], nat.options[0]); // move b before a
    const el = mkHost('po-m', [['a'], ['b'], ['c']]);
    el.selectedIndex = -1;
    el.insertBefore(el.children[1], el.children[0]);
    await new Promise((res) => setTimeout(res, 0));
    return {
      native: st(nat), host: st(el),
      order: [...el.children].map((o) => o.getAttribute('value')).join(','),
    };
  });
  expect(r.order).toBe('b,a,c'); // the move landed
  // WebKit DEVIATES (probed): it re-runs a reset that lands on the FIRST option,
  // losing the selectedness the spec keeps on the option NODE. Chromium and
  // Firefox implement the spec; the host follows that 2-engine majority on ALL
  // engines, so it is asserted as a constant — same precedent as the
  // all-disabled → -1 decline above.
  expect(r.host).toEqual({ value: 'a', selectedIndex: 1 });
  if (browserName === 'webkit') expect(r.native).toEqual({ value: 'b', selectedIndex: 0 }); // documented deviation
  else expect(r.native).toEqual(r.host); // native-differential on the majority engines
});

test('mutations: a [selected] carrier appended to a detached DIRTY host wins at connect', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('mythical-select');
    el.id = 'precar';
    el.setAttribute('name', 'precar');
    for (const [v, t] of [['a', 'alpha row'], ['b', 'bravo row']]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = t;
      el.append(o);
    }
    el.value = 'b'; // detached programmatic write → adopts + dirty
    const z = document.createElement('mythical-option');
    z.setAttribute('value', 'z');
    z.setAttribute('selected', '');
    z.textContent = 'zulu row';
    el.append(z); // [selected]-carrier appended while still DETACHED
    document.body.append(el); // connect folds the queued carrier record → 'force'
    const atConnect = { value: el.value, selectedIndex: el.selectedIndex };
    await new Promise((res) => setTimeout(res, 0)); // …and no stale replay flips it back
    return { atConnect, value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  expect(r.atConnect).toEqual({ value: 'z', selectedIndex: 2 }); // carrier beats DIRTY preservation
  expect(r).toMatchObject({ value: 'z', selectedIndex: 2, length: 3 });
});

test('mutations: detached host with a value ATTRIBUTE + streamed [selected] option — the attribute wins', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('mythical-select');
    el.id = 'preattr';
    el.setAttribute('name', 'preattr');
    el.setAttribute('value', 'b'); // pristine initial value (one-shot attribute)
    for (const [v, t, s] of [['a', 'alpha row', false], ['b', 'bravo row', false], ['c', 'charlie row', true]]) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      if (s) o.setAttribute('selected', '');
      o.textContent = t;
      el.append(o); // streamed in DETACHED — a [selected] carrier among them
    }
    document.body.append(el);
    await new Promise((res) => setTimeout(res, 0));
    return { value: el.value, selectedIndex: el.selectedIndex };
  });
  // documented extension semantics: the pending value attribute (#attrPending)
  // outranks the force-scan at the option-bearing adoption — 'force' only
  // bypasses DIRTY preservation
  expect(r).toEqual({ value: 'b', selectedIndex: 1 });
});

test('mutations: text-node edits re-adopt (characterData) — display and implicit value update, selection kept', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'cd';
    el.setAttribute('name', 'cd');
    for (const t of ['ash', 'birch']) {
      const o = document.createElement('mythical-option');
      o.textContent = t; // no value attributes — values derive from the text
      el.append(o);
    }
    document.body.append(el);
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('cd').value)).toBe('ash');
  await page.evaluate(() => {
    // pure text-node write — no childList/attribute record, only characterData
    document.getElementById('cd').children[0].firstChild.data = '  ash   tree ';
  });
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById('cd');
    return {
      value: el.value, // implicit value follows the collapsed text
      selectedIndex: el.selectedIndex, // preserved by source-element identity
      label: el.shadowRoot.querySelector('#label').textContent,
      row: el.shadowRoot.querySelector('.opt span').textContent,
    };
  })).toEqual({ value: 'ash tree', selectedIndex: 0, label: 'ash tree', row: 'ash tree' });
});

test('mutations: re-adopting while open closes the list with no dangling activedescendant', async ({ page }) => {
  await makeMutable(page);
  const btn = page.locator('#mut button');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => {
    const o = document.createElement('mythical-option');
    o.setAttribute('value', 'd');
    o.textContent = 'delta row';
    document.getElementById('mut').append(o); // mutate while open
  });
  await expect.poll(() => inspect(page, 'mut'))
    .toMatchObject({ expanded: 'false', popHidden: true, activeDesc: null });
  await btn.click(); // reopen, then remove while open
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => document.getElementById('mut').children[3].remove());
  await expect.poll(() => inspect(page, 'mut'))
    .toMatchObject({ expanded: 'false', popHidden: true, activeDesc: null });
  // Enter after reopening commits a valid, in-range index
  await btn.focus();
  await page.keyboard.press('ArrowDown'); // reopen at the kept selection
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(() => {
    const el = document.getElementById('mut');
    return { value: el.value, selectedIndex: el.selectedIndex, length: el.length };
  });
  expect(r).toEqual({ value: 'c', selectedIndex: 2, length: 3 });
});

/* ------------------------------------------------------------------- flip-up */

test('flip-up: an instance pinned to the viewport bottom opens upward', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('mythical-select');
    el.id = 'flip';
    el.style.position = 'fixed';
    el.style.bottom = '8px';
    el.style.left = '8px';
    for (const v of ['one', 'two', 'three', 'four', 'five', 'six']) {
      const o = document.createElement('mythical-option');
      o.setAttribute('value', v);
      o.textContent = v;
      el.append(o);
    }
    document.body.append(el);
  });
  await page.locator('#flip button').click();
  await expect(page.locator('#flip')).toHaveAttribute('data-flip');
  await expect(page.locator('#flip #pop')).toBeVisible();
  // the listbox renders ABOVE the trigger (wait out the open animation)
  await expect.poll(() => page.evaluate(() => {
    const r = document.getElementById('flip').shadowRoot;
    const b = r.querySelector('button').getBoundingClientRect();
    const p = r.querySelector('#pop').getBoundingClientRect();
    return p.bottom <= b.top;
  })).toBe(true);
});

/* -------------------------------------------------------------------- tokens */

test('tokens: dark theme pierces the shadow (trigger background)', async ({ page }) => {
  const light = await page.evaluate(() =>
    getComputedStyle(document.getElementById('pure').shadowRoot.querySelector('button')).backgroundColor);
  expect(light).toBe('rgb(255, 255, 255)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  // background transitions (--my-t-fast) — poll to the settled value
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.getElementById('pure').shadowRoot.querySelector('button')).backgroundColor,
  )).toBe('rgb(20, 22, 28)');
});

test('tokens: resting border uses --my-control-border in both themes', async ({ page }) => {
  const light = await page.evaluate(() =>
    getComputedStyle(document.getElementById('pure').shadowRoot.querySelector('button')).borderTopColor);
  expect(light).toBe('rgb(135, 142, 155)'); // #878E9B
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.getElementById('pure').shadowRoot.querySelector('button')).borderTopColor,
  )).toBe('rgb(95, 102, 115)'); // #5F6673
});

// --- gate r12: listener ordering + shadow-root label bridge -------------------

test('form: the reconciler corrects entries BEFORE author formdata listeners run', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = (host) => {
      const f = document.createElement('form');
      document.body.append(f);
      // registered BEFORE the control associates: in bubble phase this would run
      // first and observe the entry list before any reconciliation
      const seen = [];
      f.addEventListener('formdata', (e) => seen.push(e.formData.get('ord')));
      f.append(host);
      return { f, seen };
    };
    const el = document.createElement('mythical-select');
    el.setAttribute('name', 'ord');
    el.innerHTML = '<mythical-option value="a" selected>a</mythical-option>' +
      '<mythical-option value="b">b</mythical-option>';
    const mine = build(el);

    const nat = document.createElement('select');
    nat.name = 'ord';
    for (const v of ['a', 'b']) {
      const o = document.createElement('option');
      o.value = v; o.text = v; nat.append(o);
    }
    const ref = build(nat);
    await new Promise((res) => setTimeout(res, 0)); // let adoption settle

    // an OPTION-VALUE mutation, same task as the FormData construction: the
    // observer has NOT run, so the host's internals still hold the stale "a"
    el.children[0].setAttribute('value', 'c');
    nat.options[0].value = 'c';
    new FormData(mine.f);
    new FormData(ref.f);
    const out = { host: mine.seen, native: ref.seen };
    mine.f.remove(); ref.f.remove();
    return out;
  });
  expect(r.native).toEqual(['c']); // native updates synchronously
  expect(r.host).toEqual(['c']);   // the host must match, not expose stale "a"
});

test('label bridge: a label inside an ancestor shadow root still focuses the trigger', async ({ page }) => {
  const focused = await page.evaluate(async () => {
    // host the whole form inside a shadow root — clicks are retargeted to the
    // shadow host before reaching the document, so a document-bound bridge is blind
    const outer = document.createElement('div');
    document.body.append(outer);
    const root = outer.attachShadow({ mode: 'open' });
    root.innerHTML = `<form><label id="lab" for="inner">Region</label>
      <mythical-select id="ms"><select id="inner" name="region">
        <option value="n">north</option><option value="s" selected>south</option>
      </select></mythical-select></form>`;
    const el = root.getElementById('ms');
    await new Promise((res) => setTimeout(res, 0));
    root.getElementById('lab').click();
    const hit = root.activeElement === el && el.shadowRoot.activeElement === el.shadowRoot.querySelector('button');
    outer.remove();
    return hit;
  });
  expect(focused).toBe(true);
});
