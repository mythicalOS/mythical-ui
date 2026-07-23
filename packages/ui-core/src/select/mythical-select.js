/*! mythical-select v3 — form-associated, native-parity styled <select> for the
    mythical design system (docs/design/). Consumes the --my-* tokens (custom
    properties pierce the shadow boundary); no hardcoded brand values.

    Authoring — pure tags:
      <mythical-select name="lane" required>
        <mythical-optgroup label="Cross-model">
          <mythical-option value="codex" selected>codex cross-model</mythical-option>
        </mythical-optgroup>
        <mythical-option value="off">off</mythical-option>
      </mythical-select>
    or progressive — wrap a real native <select> (works without JS, upgrades with it;
    on upgrade the inner select is hidden and un-named so the host owns the form value):
      <mythical-select><select name="lane"><optgroup label="…"><option>…</select></mythical-select>
      Contract: after upgrade the host owns state; the hidden native select is kept in
      sync one-way (host→native) so code holding a reference reads current state; writes
      to the native select after upgrade are NOT observed. name/required/disabled/form
      forward onto the host ONCE, at first sight of the native — from then on those
      attributes are HOST-OWNED: clearing one on the host is never re-imposed by a
      later re-adoption (option mutation, form reset). The adopted native is force-
      DISABLED (disabled controls are barred from constraint validation and submission)
      so it can neither fire duplicate `invalid` events nor block the form independently
      of the host — the host owns the constraint. Initial selection reads each
      option's LIVE native selectedness — pre-upgrade script writes beat
      [selected], including a script CLEAR: live selectedIndex -1 upgrades to
      no selection (no first-enabled fallback; a matching host value attribute
      still wins). An option the script SELECTED against its own default (live
      selected, no [selected] attribute) upgrades DIRTY — its own default
      changing then no longer moves it, like native (see #adopt).
      If the native select is later moved out of the host, its PRESENTATION is restored
      (display / aria-hidden / tabindex / the author's original disabled state) but its
      name is NEVER re-added — the host owns form identity for good. Moved DIRECTLY
      into another <mythical-select>, the new host reuses the ORIGINAL presentation
      snapshot (the live attributes at that moment are the old owner's forced inert
      state, not the author's) and takes over the restore duty.

    Native-parity surface:
      attributes: name · value · disabled · required (+ form association is automatic)
      DOM API:    value · selectedIndex · options (array snapshot) · item(i) · type ·
                  labels · form · validity · validationMessage · willValidate ·
                  checkValidity() · reportValidity() · setCustomValidity(msg).
                  Option-dependent members (value, selectedIndex, options, item,
                  length — and the validity-facing validity/validationMessage/
                  willValidate/checkValidity()/reportValidity()) flush pending
                  option mutations first — same-task mutate-then-use resolves
                  like the synchronous native; FormData built in the same task
                  is reconciled via the formdata event — a GLOBAL-ORDER rebuild:
                  each host corrects ONLY its own entry, same-name entries from
                  native inputs and sibling hosts survive, and the entry list
                  keeps its original cross-name order (see #onFormdata)
      events:     input + change on user commit (bubble, composed) — programmatic
                  value/selectedIndex writes fire nothing, like native
      forms:      submits via FormData; participates in form reset,
                  fieldset[disabled], form.elements; <label for> focuses it
      defaults:   first NON-DISABLED option selected when nothing carries `selected`
                  (native semantics — use a first option with value="" for
                  required/placeholder); all options disabled → no selection.
                  A selected-but-disabled option submits NO form entry (native)
      selection:  the HTML model, PER OPTION (module-level OPT): each option has a
                  `selectedness` and a `dirtiness`. The `selected` CONTENT
                  ATTRIBUTE is only the DEFAULT — it writes selectedness while
                  that option's dirtiness is false, so a default added later
                  still moves a control the user has already used, as long as it
                  targets a different (pristine) option. A user commit or a
                  value/selectedIndex write dirties ONLY the option it selects.
                  Structural mutations (option insert/remove/MOVE) run the spec's
                  ask-for-reset; attribute/text edits never do (a cleared -1
                  selection survives them). Documented engine deviations, both
                  followed to the 2-engine majority and pinned by differential
                  tests: FIREFOX ignores a [selected] add on index 0 while
                  another option is selected (it honors it at every other index);
                  WEBKIT re-runs a reset on an option MOVE, losing the
                  selectedness the spec keeps on the option node
      limits:     a MutationObserver reports mutations asynchronously and in
                  batches, so a single task's INTERMEDIATE DOM states are only
                  reconstructed, never observed. Ordered child-list replay covers
                  the ordinary shapes (insert / remove / move, incl. a move's
                  removal-reset preceding its reinsertion), but four contradictory
                  same-task batches resolve to the FINAL DOM where native would
                  resolve step-by-step: (1) a pristine option's [selected] edited
                  while DETACHED, then reinserted; (2) the same option's
                  [selected] added AND removed in one task; (3) an option removed
                  and another DISABLED in one task while the selection is -1;
                  (4) a multi-move batch, or one option inserted AND removed, in a
                  single task. All four need mutually-cancelling edits in one
                  task; the ordinary reactive-framework shape — moving [selected]
                  from one option to another on re-render — matches native on all
                  three engines (probed). Cross-model gate CAPPED at 14 rounds
                  here: these are the residual, non-consumer-plausible gaps.
      keyboard:   Enter/Space/Arrows open (Alt+ArrowDown too — APG chord) · closed
                  Home/End open at first/last enabled · Arrows/Home/End move ·
                  Enter/Space commit · open Alt+ArrowUp commits + closes (APG chord) ·
                  Tab commits + moves focus on · Esc closes · typeahead (also
                  closed-typeahead commit, like native; Ctrl/Alt/Meta chords ignored)
      a11y:       APG select-only combobox — the shadow trigger is role=combobox
                  (aria-expanded, aria-controls, aria-activedescendant while open) over
                  the role=listbox popup; labeled option groups render as role=group
                  containers labelled (aria-labelledby) by their headings; external
                  <label> text is mirrored onto the trigger as aria-label
                  (aria-labelledby cannot cross the shadow root; the host's own subtree
                  is excluded from a wrapping label's text, and the mirror refreshes on
                  focus); EXPLICIT naming attributes outrank the label mirror —
                  host aria-labelledby (idrefs resolved in the host's root node) >
                  host aria-label > the wrapped native's aria-labelledby/aria-label >
                  associated-<label> text; labels that target the WRAPPED native select join the
                  mirrored name too (host-targeting labels first), and clicking one
                  focuses the trigger — the force-disabled native can't take the
                  activation; the selected-option text is the combobox VALUE, not its name;
                  required/user-invalid state is reflected onto the trigger as
                  aria-required/aria-invalid
      variant:    variant="chip" → the compact policy-chip look (hero/detail chips) —
                  squared like every interactive control; pills are never interactive (§5)
      browsers:   any engine with ElementInternals (Chrome/Edge 77+, Firefox 93+,
                  Safari 16.4+). Engines that parse this file but lack ElementInternals
                  degrade to a working native <select>: progressive instances keep the
                  one they wrap, pure-tag instances get one synthesized — submitted
                  forms keep working; the JS API and post-connect option mutation are
                  NOT emulated there. Engines too old to parse modern class syntax
                  (Safari <15, Chrome <84, Firefox <90) get no upgrade at all — author
                  progressive mode where those matter.
      CSP:        styling under strict CSP (style-src without 'unsafe-inline') requires
                  constructable stylesheets (Chrome 73+/Edge 79+, Firefox 101+,
                  Safari 16.4+). Firefox 93–100 has ElementInternals but NOT
                  adoptedStyleSheets and falls back to an inline <style>, which a
                  strict style-src blocks — functional but unstyled there.
    Not supported (use a native <select>): multiple, size (listbox mode). */
(() => {
  if (typeof customElements === 'undefined' || customElements.get('mythical-select')) return;

  // Inert data carriers — defined so :defined styling works and the parser keeps them.
  // Every define is guarded individually: a pre-registered helper name must not
  // throw and kill the registrations that follow it.
  if (!customElements.get('mythical-option')) customElements.define('mythical-option', class extends HTMLElement {});
  if (!customElements.get('mythical-optgroup')) customElements.define('mythical-optgroup', class extends HTMLElement {});

  // HTMLOptionElement canonicalization ("strip and collapse ASCII whitespace"):
  // the implicit value and the display text derive from the text content with
  // ASCII-whitespace runs collapsed to single spaces and the ends trimmed — the
  // same normalization the native .value/.text/.label getters apply. HTML ASCII
  // whitespace ONLY (tab/LF/FF/CR/space): native canonicalization PRESERVES
  // NBSP and other non-ASCII whitespace ("10&nbsp;GB" must stay "10 GB"),
  // so neither \s nor .trim() (both eat U+00A0 etc.) may be used here. Shared
  // by the full component AND the no-ElementInternals fallback below.
  const collapse = s => s.replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '');

  // No ElementInternals (pre-2023 engines): degrade to a working native <select>.
  // Progressive instances keep the select they wrap; pure-tag instances get one
  // synthesized from their <mythical-option> tags — submitted forms keep working,
  // unskinned. Deliberately minimal: no JS API, no post-connect option mutation.
  if (!('attachInternals' in HTMLElement.prototype) || typeof ElementInternals === 'undefined') {
    // Defining the element defeats :not(:defined) FOUC guards, so hide the raw
    // option tags ourselves until the native select is synthesized.
    const st = document.createElement('style');
    st.textContent = 'mythical-select mythical-option,mythical-select mythical-optgroup{display:none}';
    (document.head || document.documentElement).append(st);
    if (!customElements.get('mythical-select')) customElements.define('mythical-select', class extends HTMLElement {
      connectedCallback() {
        // During parsing, connectedCallback fires before children exist — defer.
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
        } else this.#build();
      }
      #build() {
        if (this.querySelector('select')) return; // progressive — already native
        const sel = document.createElement('select');
        // `form` forwards too — a host with form="f" outside its form must
        // keep submitting into THAT form via the synthesized select.
        for (const a of ['name', 'required', 'disabled', 'form'])
          if (this.hasAttribute(a)) sel.setAttribute(a, this.getAttribute(a) || '');
        const opt = el => {
          const o = document.createElement('option');
          // same canonicalization as the full component: implicit value and
          // display text strip-and-collapse; a label attribute overrides display
          const t = collapse(el.textContent);
          o.value = el.getAttribute('value') ?? t;
          o.text = t;
          if (el.hasAttribute('label')) o.setAttribute('label', el.getAttribute('label'));
          o.disabled = el.hasAttribute('disabled');
          o.selected = el.hasAttribute('selected');
          return o;
        };
        for (const el of [...this.children]) {
          if (el.localName === 'mythical-optgroup') {
            const g = document.createElement('optgroup');
            g.label = el.getAttribute('label') || '';
            g.disabled = el.hasAttribute('disabled');
            for (const c of el.children) if (c.localName === 'mythical-option') g.append(opt(c));
            sel.append(g); el.remove();
          } else if (el.localName === 'mythical-option') { sel.append(opt(el)); el.remove(); }
        }
        // Honor a value attribute only when an option matches (native-parity:
        // a stale value must not clear the [selected]/first-option default).
        const v = this.getAttribute('value');
        if (v !== null && [...sel.options].some(o => o.value === v)) sel.value = v;
        this.append(sel);
      }
    });
    return;
  }

  const CSS = `
:host{display:inline-block;position:relative;min-width:180px;
  font:var(--my-fs-body,14px)/1.4 var(--my-font-ui,-apple-system,sans-serif)}
:host([hidden]){display:none}
:host([variant="chip"]){min-width:0}
button{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 10px;
  border:1px solid var(--my-control-border,#878E9B);border-radius:var(--my-r-control,6px);
  /* control boundary ≥3:1 (--my-control-border) — the popover keeps --my-border:
     it is an overlay surface, not a control boundary */
  background:var(--my-surface,#fff);color:var(--my-ink,#16181D);font:inherit;cursor:pointer;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  transition:border-color var(--my-t-fast,120ms ease),background var(--my-t-fast,120ms ease)}
button:hover{border-color:var(--my-muted,#5A5F6A)}
button:focus-visible{outline:2px solid var(--my-accent,#0F6B66);outline-offset:2px}
:host([data-open]) button{border-color:var(--my-accent,#0F6B66)}
:host(:user-invalid) button{border-color:var(--my-error,#B3261E)}
:host([data-user-invalid]) button{border-color:var(--my-error,#B3261E)}
:host([disabled]) button,:host([data-form-disabled]) button{
  background:var(--my-disabled-bg,#F1EFE9);color:var(--my-disabled-ink,#9AA0AC);
  border-color:transparent;cursor:not-allowed}
:host([variant="chip"]) button{height:28px;padding:0 12px;font-size:12.5px;
  border-radius:var(--my-r-control,6px)}
#label{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#label:empty::before{content:"\\00a0"}
.car{flex:none;color:var(--my-muted,#5A5F6A);transition:transform var(--my-t-fast,120ms ease)}
:host([data-open]) .car{transform:rotate(180deg)}
#pop{position:absolute;top:calc(100% + 6px);left:0;z-index:30;min-width:100%;max-height:280px;
  overflow:auto;overscroll-behavior:contain;padding:6px;background:var(--my-surface,#fff);
  border:1px solid var(--my-border,#E7E3DB);border-radius:var(--my-r-card,10px);
  box-shadow:var(--my-shadow-modal,0 16px 48px rgba(22,24,29,.16));
  scrollbar-width:thin;scrollbar-color:var(--my-border,#E7E3DB) transparent}
#pop::-webkit-scrollbar{width:8px}
#pop::-webkit-scrollbar-thumb{background:var(--my-border,#E7E3DB);border-radius:4px}
#pop[hidden]{display:none}
#pop:not([hidden]){animation:in var(--my-t-fast,120ms ease)}
:host([data-flip]) #pop{top:auto;bottom:calc(100% + 6px)}
:host([data-flip]) #pop:not([hidden]){animation-name:in-flip}
@keyframes in{from{opacity:0;transform:translateY(-4px)}}
@keyframes in-flip{from{opacity:0;transform:translateY(4px)}}
.grp{font-size:10px;font-weight:650;text-transform:uppercase;letter-spacing:.4px;
  color:var(--my-muted,#5A5F6A);padding:7px 10px 3px}
/* hairline separator above each subsequent group container (options sit INSIDE
   role=group wrappers now, so .opt never directly precedes a .grp heading) */
[role="group"] + [role="group"],.opt + [role="group"]{
  margin-top:4px;border-top:1px solid var(--my-border,#E7E3DB);padding-top:1px}
.opt{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 10px;
  border-radius:var(--my-r-control,6px);font-size:12.5px;cursor:pointer;white-space:nowrap;
  -webkit-tap-highlight-color:transparent}
.opt[data-active]{background:var(--my-surface-hover,#F6F4EF)}
.opt[aria-selected="true"]{color:var(--my-accent-strong,#0B5450);font-weight:var(--my-fw-medium,500)}
.opt[aria-disabled="true"]{color:var(--my-disabled-ink,#9AA0AC);cursor:not-allowed}
.mark{visibility:hidden}
.opt[aria-selected="true"] .mark{visibility:visible}
@media (prefers-reduced-motion:reduce){#pop:not([hidden]){animation:none}.car{transition:none}}`;

  // One constructable sheet shared by every instance (works under style-src without
  // 'unsafe-inline'); engines without adoptedStyleSheets get a per-instance <style>
  // element populated via textContent — never an HTML-string sink.
  let SHEET = null;
  const applyCSS = root => {
    try {
      if (!SHEET) { const s = new CSSStyleSheet(); s.replaceSync(CSS); SHEET = s; }
      root.adoptedStyleSheets = [SHEET];
    } catch {
      const st = document.createElement('style');
      st.textContent = CSS;
      root.append(st);
    }
  };
  const SVGNS = 'http://www.w3.org/2000/svg';

  // WebIDL `long` conversion (native parity for numeric API arguments):
  // ToNumber, truncate toward zero, non-finite (NaN/±Infinity) → 0. item()
  // layers unsigned-long semantics on top (negatives → null) at its call site.
  const toLong = v => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; };

  // Interactive content (HTML label activation rules): a label click that
  // lands on interactive content INSIDE the label does not activate the
  // labeled control — the nested link/button/input keeps its own behavior.
  const INTERACTIVE = 'a[href],button,input,select,textarea,[tabindex],[contenteditable],audio[controls],video[controls]';

  // Adopted-native presentation snapshots — MODULE-level, keyed by the native
  // element with its current OWNER host recorded, so a native moved directly
  // between hosts keeps ONE original-author snapshot: the adopting host that finds
  // an existing entry reuses it (the live attributes at that moment are the old
  // owner's forced inert state, not the author's) and takes ownership, and only
  // the recorded owner may run the departed-native restore — which consumes the
  // entry, so the restore happens exactly once.
  const SNAPS = new WeakMap(); // native <select> → { owner, display, ariaHidden, tabindex, disabled }

  /* Per-OPTION selection state — the HTML model (replaces a select-wide dirty
     flag plus an adoption-strength enum). Every option element carries:
       selectedness  is this option selected RIGHT NOW;
       dirtiness     has a user commit / programmatic selection touched this
                     option — which makes its `selected` CONTENT ATTRIBUTE stop
                     writing selectedness (the attribute is only the DEFAULT).
     MODULE-level and keyed by the option ELEMENT (precedent: SNAPS above), so
     the state survives re-adoption, reordering, detach and even a move between
     hosts — exactly like native, where selectedness lives on the option NODE,
     never on the select. Selection is therefore never reconstructed from a
     fresh [selected] attribute scan: adoption reads these live flags. */
  const OPT = new WeakMap(); // option element → { selectedness, dirtiness }
  const isOpt = n => n.localName === 'mythical-option' || n.localName === 'option';
  const isGrp = n => n.localName === 'mythical-optgroup' || n.localName === 'optgroup';
  // Seed at FIRST SIGHT from the `selected` content attribute (the option's
  // default selectedness). `live` overrides it for the options of a wrapped
  // native at UPGRADE, where the real select's resolved selectedness (which a
  // pre-upgrade script may have written) is the truth — see #adopt.
  const optState = (el, live) => {
    let s = OPT.get(el);
    if (!s) OPT.set(el, s = live ?? { selectedness: el.hasAttribute('selected'), dirtiness: false });
    return s;
  };

  // formdata reconciliation bookkeeping — per FormDataEvent, SHARED by every
  // reconciler in that event (see #onFormdata): the FIRST reconciler to
  // REGISTER snapshots the COMPLETE entry list (every name, original GLOBAL
  // order) before any edit lands; each reconciler registers its correction
  // keyed by its DOCUMENT RANK among same-name mythical-select hosts; and
  // EVERY reconciler rebuilds the entire list from snapshot + corrections —
  // idempotent, so the final list is independent of listener run order.
  // Keyed on the event object: each FormData construction is its own event,
  // and the entry GCs with it.
  const FD = new WeakMap(); // FormDataEvent → { snap: [name, value][], corr: Map<name, {rank, stale, desired}[]> }

  class MythicalSelect extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['value', 'disabled', 'required', 'name',
      'aria-label', 'aria-labelledby']; // explicit naming attrs re-mirror (#syncLabel)
    #internals; #btn; #labelEl; #pop; #native = null;
    #opts = []; #idx = -1; #act = -1; #open = false; #adopted = false;
    // One-shot value-attribute path: stays armed until the first adoption that
    // actually FINDS options — a register-before-markup connect adopts zero
    // children and must NOT consume it (the options stream in afterwards) — and
    // never applies once the host is dirty. Re-armed by formResetCallback.
    #attrPending = true;
    #customError = ''; #ta = ''; #taT = 0; #mo; #onDocDown; #touched = false;
    // Activation bridge for INNER-native labels: ONE delegated click listener
    // on the host's root document while a native is adopted (see
    // #bindLabelBridge) — resolving against the CURRENT native.labels at click
    // time, so labels added or retargeted AFTER adoption keep working.
    // #labelDoc records the document actually bound (removeEventListener must
    // target the same node even if the host changes documents).
    #labelDoc = null; #onLabelClick;
    // formdata reconciliation: the ASSOCIATED form (tracked via
    // formAssociatedCallback) carries ONE `formdata` listener per association
    // so same-task FormData construction serializes fresh state (#onFormdata).
    // #lastFormValue mirrors the value last handed to setFormValue — the exact
    // entry THIS host contributed to a formdata event's entry list, used to
    // locate OUR occurrence among same-name entries (null = no entry).
    #form = null; #onFormdata; #lastFormValue = null;
    // Selection DIRTINESS now lives PER OPTION (module-level OPT), like native.
    // This host-level latch is only the guard on the one-shot value ATTRIBUTE:
    // once a user commit or a value/selectedIndex write has picked a selection,
    // a value attribute that has not been consumed yet (options streamed in
    // after the write) must not override it. Re-armed by formResetCallback.
    #written = false;

    constructor() {
      super();
      this.#internals = this.attachInternals();
      const r = this.attachShadow({ mode: 'open', delegatesFocus: true });
      applyCSS(r);
      // Skeleton via DOM APIs — no HTML-string sinks (strict CSP / Trusted Types safe).
      // APG select-only combobox: the trigger owns role, name, expanded state, the
      // popup relationship (aria-controls) and the active descendant.
      const btn = this.#btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('part', 'control');
      btn.setAttribute('role', 'combobox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'pop');
      this.#labelEl = document.createElement('span');
      this.#labelEl.id = 'label';
      // SVG caret, not a text glyph — renders identically across platforms/fonts.
      const svg = document.createElementNS(SVGNS, 'svg');
      for (const [k, v] of [['class', 'car'], ['width', '10'], ['height', '6'],
        ['viewBox', '0 0 10 6'], ['aria-hidden', 'true']]) svg.setAttribute(k, v);
      const path = document.createElementNS(SVGNS, 'path');
      for (const [k, v] of [['d', 'M1 1l4 4 4-4'], ['fill', 'none'],
        ['stroke', 'currentColor'], ['stroke-width', '1.5'], ['stroke-linecap', 'round'],
        ['stroke-linejoin', 'round']]) path.setAttribute(k, v);
      svg.append(path);
      btn.append(this.#labelEl, svg);
      const pop = this.#pop = document.createElement('div');
      pop.id = 'pop';
      pop.setAttribute('part', 'popover');
      pop.setAttribute('role', 'listbox');
      pop.hidden = true;
      r.append(btn, pop);
      this.#btn.addEventListener('click', () => this.#toggle());
      this.#btn.addEventListener('keydown', e => this.#onKey(e));
      this.#pop.addEventListener('pointerdown', e => e.preventDefault()); // focus stays on the control
      this.#pop.addEventListener('pointermove', e => {
        const o = e.target.closest('.opt');
        if (o && o.getAttribute('aria-disabled') !== 'true') this.#setActive(+o.dataset.i);
      });
      this.#pop.addEventListener('click', e => {
        const o = e.target.closest('.opt');
        if (o && o.getAttribute('aria-disabled') !== 'true') this.#commit(+o.dataset.i);
      });
      // Outside pointerdown (and any focus-out it causes) closes WITHOUT
      // committing — native <select> cancels on outside click on both macOS and
      // Windows; Tab is the committing departure (deliberate, reviewed).
      this.#onDocDown = e => { if (!e.composedPath().includes(this)) this.#close(); };
      // Delegated INNER-native label activation (bound in #bindLabelBridge while
      // a native is adopted): if the clicked label is CURRENTLY associated with
      // the wrapped native, focus the trigger — the force-disabled native can't
      // take the activation. Guard at click time, not bind time: a host disabled
      // AFTER binding must not have its trigger focused (native-disabled parity).
      this.#onLabelClick = e => {
        if (!this.#native || this.#btn.disabled) return;
        const l = e.target instanceof Element ? e.target.closest('label') : null;
        if (!l || ![...this.#native.labels].includes(l)) return;
        // HTML label activation does NOT fire for clicks on interactive
        // content inside the label — a nested link/button/input keeps its own
        // behavior instead of activating the control. The closest() search
        // stops at the label (the label itself never counts, nor anything
        // outside it); the wrapped native select is exempt — it is
        // force-disabled, and the bridge exists exactly to stand in for it.
        const hit = e.target.closest(INTERACTIVE);
        if (hit && hit !== l && hit !== this.#native && l.contains(hit)) return;
        this.#btn.focus();
      };
      // FormData built in the SAME task as an option mutation would serialize
      // the stale ElementInternals value (the observer is async; native option
      // lists are synchronous — setFormValue only lands after the observer
      // task). Reconcile on the `formdata` event, which fires synchronously
      // while the entry list is constructed: drain pending mutations, then
      // rebuild the outgoing FormData with this control's correction applied —
      // a GLOBAL-ORDER rebuild (per-name delete+re-append would move the
      // name's entries to the END of the whole list; see the FD state above).
      this.#onFormdata = e => {
        // The entry list was built from the internals value AT EVENT ENTRY —
        // capture it BEFORE the drain below refreshes setFormValue.
        const stale = this.#lastFormValue;
        this.#drain();
        const name = this.getAttribute('name');
        // A disabled control contributed no entry (disabled controls are
        // barred from submission) — and must not touch (or claim) a same-name
        // entry some OTHER control may legitimately own.
        if (!name || this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled')) return;
        const o = this.#opts[this.#idx];
        // Mirrors #setIndex's setFormValue rule: a selected-but-disabled
        // option — directly or via its group — or no selection submits NO entry.
        const desired = o && !o.disabled ? o.value : null;
        if (stale === null && desired === null) return; // contributed nothing, wants nothing — done
        // (a) FIRST registering reconciler on this event: snapshot the
        // COMPLETE entry list (every name, original global order) before any
        // edit lands — the list is only ever edited by the rebuild below, so
        // at first registration it is still exactly as constructed.
        let st = FD.get(e);
        if (!st) FD.set(e, st = { snap: [...e.formData], corr: new Map() });
        // (b) Register this host's correction keyed by its DOCUMENT RANK among
        // same-name mythical-select hosts (form.elements is tree-ordered and
        // includes form-associated custom elements) — deterministic and
        // independent of listener attach order, so every rebuild resolves the
        // same value-to-slot assignment no matter which reconciler runs it.
        // Registered even when desired === stale: the claim must still occupy
        // its slot so equal-valued siblings resolve around it.
        const rank = [...this.#form.elements]
          .filter(el => el.localName === 'mythical-select' && el.getAttribute('name') === name)
          .indexOf(this);
        let corr = st.corr.get(name);
        if (!corr) st.corr.set(name, corr = []);
        corr.push({ rank, stale, desired });
        // (c) EVERY reconciler rebuilds the ENTIRE list from snapshot +
        // corrections (idempotent — reruns converge on the same list).
        // Slot assignment per corrected name: entries carry no owner identity,
        // so slots are matched by VALUE — the k same-name mythical hosts
        // claiming stale value v take, in document-rank order, the LAST k
        // occurrences of v among that name's snapshot entries (each host
        // contributed its own stale entry, so an occurrence exists; taking
        // the last ones leaves a preceding equal-valued NATIVE entry — e.g.
        // <input value="a"> ahead of a stale-"a" host — unclaimed); natives
        // keep the remaining slots, stationary.
        // DOCUMENTED LIMITATION (platform boundary — FormData has no
        // positional insert, and native submitting-ness is not replicable
        // exactly): when same-name NATIVE controls interleave between
        // same-name mythical hosts AND hold values equal to a mythical host's
        // stale value, the value-to-slot assignment can still swap between
        // those equal-valued slots — the list ORDER is always preserved and
        // the value MULTISET is always correct, but WHICH equal-valued slot
        // received the correction may differ from a real native form.
        const assign = new Map(); // snapshot index → replacement (null = drop in place)
        const tails = []; // [name, value] appends — the placement rule below
        for (const [n, list] of st.corr) {
          const slots = []; // this name's snapshot entries, global indices ascending
          st.snap.forEach(([en], i) => { if (en === n) slots.push(i); });
          const byRank = [...list].sort((a, b) => a.rank - b.rank);
          const claims = new Map(); // stale value → total claim count k
          for (const c of byRank) if (c.stale !== null) claims.set(c.stale, (claims.get(c.stale) ?? 0) + 1);
          const queue = new Map(); // stale value → its claimed slots (the LAST k, ascending)
          for (const [v, k] of claims)
            queue.set(v, slots.filter(i => st.snap[i][1] === v).slice(-k));
          for (const c of byRank) {
            const at = c.stale === null ? undefined : queue.get(c.stale).shift();
            if (at !== undefined) assign.set(at, c.desired); // replace, or remove (desired null)
            // No slot to edit (this host contributed nothing at event time —
            // e.g. a same-task re-enable of its selected-disabled option):
            // the true document-order position is unknowable, so the
            // PLACEMENT RULE is best-effort — a previously-contribute-nothing
            // host's new entry appends at the END of the whole list
            // (document-rank order among same-event same-name inserts).
            else if (c.desired !== null) tails.push([n, c.desired]);
          }
        }
        // Rebuild: delete every name present in the snapshot or corrections,
        // then re-append ALL entries in ORIGINAL global order with the
        // corrections applied — removed entries drop in place, cross-name
        // order survives, tail inserts land last.
        const names = new Set(st.snap.map(([n]) => n));
        for (const n of st.corr.keys()) names.add(n);
        for (const n of names) e.formData.delete(n);
        st.snap.forEach(([n, v], i) => {
          const out = assign.has(i) ? assign.get(i) : v;
          if (out !== null) e.formData.append(n, out);
        });
        for (const [n, v] of tails) e.formData.append(n, v);
      };
      // <label for> activation: every engine forwards the label's click to the
      // host (composedPath()[0] === host — impossible for real pointer clicks,
      // which always start inside the shadow tree), but WebKit does not forward
      // FOCUS to a form-associated element's delegatesFocus target. Do it
      // ourselves — native parity: clicking a select's label focuses it
      // (and only focuses: it never opens the picker).
      this.addEventListener('click', e => {
        if (e.composedPath()[0] === this) this.#btn.focus();
      });
      // Blocked form submission fires `invalid` at the element — that's the
      // interaction signal :user-invalid keys on; mirror it for the fallback attr.
      this.addEventListener('invalid', () => { this.#touched = true; this.#updateValidity(); });
      // Label text can change after adoption (no observer watches the light DOM
      // around us) — recompute the mirrored aria-label when focus arrives, so it
      // is fresh at the moment a screen reader announces the control.
      this.addEventListener('focusin', () => this.#syncLabel());
      // Focus DEPARTURE while open (programmatic el2.focus(), AT focus moves…)
      // cancels like outside-click: close WITHOUT committing. relatedTarget is
      // null when focus leaves the document — outside too. Option clicks never
      // land here (#pop's pointerdown preventDefault keeps focus on the trigger),
      // and Tab keeps its commit: keydown committed + closed BEFORE focus moved,
      // so #open is already false when this fires.
      this.addEventListener('focusout', e => {
        if (!this.#open) return;
        const t = e.relatedTarget;
        if (t instanceof Node && (this.contains(t) || r.contains(t))) return;
        this.#close();
      });
      // ONE observer for the element's whole life, observing from construction —
      // never per-connect (repeated connects would stack observers, and a
      // DETACHED host would never see its wrapped native depart, so its
      // presentation restore would never run). Observation works on detached
      // trees and does not leak: observer and host GC together. Pre-connection
      // mutations flow through the SAME record replay (#replay).
      this.#mo = new MutationObserver(recs => {
        const rel = this.#relevant(recs);
        if (rel.length) this.#adopt({ recs: rel });
      });
      this.#mo.observe(this, { childList: true, subtree: true, attributes: true,
        characterData: true, // text-node edits re-adopt (label/implicit value)
        attributeFilter: ['value', 'label', 'disabled', 'selected'] });
    }

    connectedCallback() {
      // Fold any records still queued from PRE-CONNECT mutations into this
      // adoption — they carry real selection semantics (a [selected] option
      // streamed in while detached), and replaying them afterwards would
      // re-resolve against a consumed #attrPending.
      this.#adopt({ recs: this.#relevant(this.#mo.takeRecords()) });
    }
    // Disconnect drops the document-level label bridge (no leak through a
    // departed host); reconnect re-binds it via connectedCallback → #adopt.
    disconnectedCallback() { this.#close(); this.#unbindLabelBridge(); }

    /* Records worth re-adopting for. Attribute records on the HOST itself belong
       to attributeChangedCallback — re-adopting on them would e.g. revert an
       unmatched value="…" write (no-match → selection correctly cleared) back to
       the [selected]/first default while the attribute still says otherwise.
       Everything else (child/subtree childList, option attributes, text) either
       carries selection semantics (see #replay) or refreshes the rendered list. */
    #relevant(recs) { return recs.filter(r => r.type !== 'attributes' || r.target !== this); }

    /* Synchronous flush of pending option mutations (the MutationObserver is
       async; native option lists are synchronous): called at the top of every
       PUBLIC option-dependent member — the value/selection/options surface AND
       the validity-facing members (validity, validationMessage, willValidate,
       checkValidity, reportValidity), plus the formdata reconciliation
       listener — so same-task mutate-then-use resolves against the fresh
       option list — never in internal paths (#adopt already flushes its own
       records at the end, so this cannot recurse). Records are
       classified exactly like the async callback would classify them; taking
       them here empties the observer queue, so the callback won't replay them. */
    #drain() {
      const recs = this.#relevant(this.#mo.takeRecords());
      if (recs.length) this.#adopt({ recs });
    }

    attributeChangedCallback(n, ov, nv) {
      // Pre-adoption attrs are read by #adopt() itself — its tail #syncLabel /
      // #syncDisabled / #updateValidity calls pick them up, so the early-return
      // below is safe for the aria naming attrs too.
      if (!this.#adopted) return;
      if (n === 'value' && ov !== nv) this.value = nv ?? '';
      if (n === 'disabled') this.#syncDisabled();
      if (n === 'required') this.#updateValidity();
      if (n === 'aria-label' || n === 'aria-labelledby') this.#syncLabel();
    }

    /* ---- option adoption: pure tags, or a wrapped native <select> ----
       Selection is NEVER reconstructed from a fresh [selected] scan: it is read
       off the LIVE per-option selectedness (module-level OPT), which the record
       replay below maintains exactly like native maintains it on the option
       nodes. Callers:
         { recs }   observer/drain/connect — the mutation records to replay IN
                    ORDER (a removal's ask-for-reset must land before the
                    matching re-insertion of a MOVE — see #replay);
         { reset }  form reset — option state is put back to the [selected]
                    defaults by formResetCallback, then ask-for-reset runs here.
       The FIRST adoption of pure tags also asks for a reset (that is what a
       parsed <select> does). The first adoption of a WRAPPED native does NOT:
       the real select already resolved its own selection, and its live
       selectedness — including a pre-upgrade script write, or a script CLEAR to
       -1 — is what we adopt (header contract). */
    #adopt({ recs = [], reset = false } = {}) {
      // Re-adoption while open: close first and drop the active-index state so
      // the rebuild can leave no dangling aria-activedescendant idref and no
      // out-of-range commit target.
      if (this.#open) this.#close();
      this.#act = -1;
      const native = this.querySelector(':scope > select');
      const upgrading = native && native !== this.#native; // first sight of this native
      // A previously-adopted native that is no longer our child gets its
      // PRESENTATION back — the EXACT pre-upgrade inline display / aria-hidden /
      // tabindex snapshotted at adoption, not cleared-to-empty values — never its
      // name: the host owns form identity (header contract). Only the RECORDED
      // owner restores (moved directly into another host, the native has a new
      // owner whose adoption reuses the snapshot — restoring here would fight
      // it), and restoring CONSUMES the entry so it runs exactly once.
      if (this.#native && this.#native.parentNode !== this) {
        const s = SNAPS.get(this.#native);
        if (s && s.owner === this) {
          SNAPS.delete(this.#native);
          this.#native.style.display = s.display;
          if (s.ariaHidden === null) this.#native.removeAttribute('aria-hidden');
          else this.#native.setAttribute('aria-hidden', s.ariaHidden);
          if (s.tabindex === null) this.#native.removeAttribute('tabindex');
          else this.#native.setAttribute('tabindex', s.tabindex);
          // the adoption-time force-disable (below) comes off too — the AUTHOR's
          // original disabled state returns, not our own
          if (s.disabled === null) this.#native.removeAttribute('disabled');
          else this.#native.setAttribute('disabled', s.disabled);
        }
      }
      const list = [];
      // `el` = the SOURCE element per option — selection preservation across
      // re-adoption is by identity first (see the order note below).
      // Canonical option properties (native parity): a wrapped native's options
      // are read through HTMLOptionElement.value/.text/.label — value falls back
      // to the whitespace-stripped-and-collapsed text, a label attribute
      // overrides the DISPLAY text (never the text-derived value). mythical-option
      // gets the SAME normalization via collapse().
      const push = (el, grp) => {
        const nat = el.tagName === 'OPTION';
        const text = nat ? el.text : collapse(el.textContent);
        list.push({
          el,
          grpEl: grp ?? null, // source GROUP element — boundaries/validity key on identity
          value: nat ? el.value : el.getAttribute('value') ?? text,
          text,
          label: nat ? el.label : el.getAttribute('label') ?? text,
          disabled: el.hasAttribute('disabled') || (grp?.hasAttribute('disabled') ?? false),
          group: grp?.getAttribute('label') || null,
        });
      };
      const scan = (root, opt, grp) => {
        for (const el of root.children) {
          if (el.matches(grp)) { for (const o of el.children) if (o.matches(opt)) push(o, el); }
          else if (el.matches(opt)) push(el, null);
        }
      };
      if (native) {
        // Upgrade: the host owns the form value; the native control goes inert and is
        // thereafter kept in sync one-way host→native (contract in the header).
        // Snapshot the ORIGINAL presentation first (only on first sight — later
        // re-adoptions see our own inert values) for an exact departed-native
        // restore. A native arriving FROM another host still carries that owner's
        // forced inert state, not the author's: REUSE the original snapshot and
        // just take ownership (module-level SNAPS — the old owner's restore path
        // then skips, see above).
        if (upgrading) {
          const prev = SNAPS.get(native);
          if (prev) prev.owner = this;
          else SNAPS.set(native, {
            owner: this,
            display: native.style.display,
            ariaHidden: native.getAttribute('aria-hidden'),
            tabindex: native.getAttribute('tabindex'),
            disabled: native.getAttribute('disabled'), // the AUTHOR's — read before the force-disable below
          });
          // Attribute forwarding happens ONLY here, at first sight of this
          // native: from then on the host's attributes are HOST-OWNED — a
          // consumer clearing a forwarded required/disabled/form on the host
          // must not get it re-imposed by later re-adoptions (option mutations,
          // form reset). `form` forwards too: FACE honors the form content
          // attribute for association, so a wrapped <select form="f"> outside
          // its form keeps submitting into THAT form after upgrade.
          for (const a of ['name', 'required', 'form'])
            if (native.hasAttribute(a) && !this.hasAttribute(a)) this.setAttribute(a, native.getAttribute(a) || '');
          // disabled forwards from the SNAPSHOT, never the live attribute: a
          // native arriving FROM another host still carries that owner's
          // force-disable — reading it live would wrongly disable the host on
          // the author's behalf.
          const snap = SNAPS.get(native);
          if (snap.disabled !== null && !this.hasAttribute('disabled'))
            this.setAttribute('disabled', snap.disabled);
        }
        native.style.display = 'none'; native.setAttribute('aria-hidden', 'true');
        native.tabIndex = -1;
        // Force-disable the adopted native AFTER the forwarding above: disabled
        // controls are barred from constraint validation and submission, so the
        // hidden native can't fire duplicate `invalid` events or block the form
        // independently of the host (its name is removed, but unnamed controls
        // still constraint-validate). Guarded — blindly re-setting the attribute
        // would retrigger the MutationObserver ('disabled' is in its filter).
        // Host→native selectedIndex sync is unaffected: property writes on a
        // disabled select work fine.
        if (!native.disabled) native.disabled = true;
        native.removeAttribute('name');
        scan(native, 'option', 'optgroup');
      } else {
        scan(this, 'mythical-option', 'mythical-optgroup');
      }
      // Seed per-option state for every option now in the list, BEFORE the
      // replay: an option INSERTED by these very records must already carry the
      // selectedness its [selected] attribute gives it when its insertion asks
      // for a reset (that is how an inserted [selected] carrier wins).
      // At UPGRADE the wrapped native's own resolved selectedness is the truth
      // (a pre-upgrade script write beats stale [selected] attrs — header
      // contract), so seed from the LIVE property instead of the attribute.
      // Its dirtiness is inferred: an option the script SELECTED against its
      // own default (live selected, no [selected] attribute) is dirty in the
      // real select too — a later attribute change must not move it. Options
      // the script merely DESELECTED keep dirtiness false, like native (only
      // the newly selected option is made dirty). DOCUMENTED, undetectable edge
      // (unchanged): a pre-upgrade script that selected the option that was
      // ALREADY the default reads as pristine — a wrapped select's interaction
      // history is not inspectable.
      for (const o of list)
        optState(o.el, upgrading
          ? { selectedness: o.el.selected, dirtiness: o.el.selected && !o.el.hasAttribute('selected') }
          : undefined);
      // Records are only replayed against an ALREADY-ADOPTED list: anything
      // queued before the first adoption merely describes how the initial DOM
      // was built, which the scan + seeding above already captures in full.
      // Replaying it would re-insert those options into an empty list and ask
      // for a reset — resurrecting a selection an upgraded native deliberately
      // has none of (a pre-upgrade script CLEAR).
      if (this.#adopted) this.#replay(recs, list);
      this.#native = native;
      this.#opts = list;
      // Activation bridge for INNER-native labels (progressive markup commonly
      // labels the wrapped select itself): one DELEGATED document click listener
      // while a native is adopted — labels added or retargeted after adoption
      // still bridge (resolved against the current native.labels at click time).
      // Departure unbinds it, so a departed native's labels revert to plain
      // native activation against the restored select.
      if (native) this.#bindLabelBridge(); else this.#unbindLabelBridge();
      // listbox DOM — built with createElement/textContent, no HTML-string sinks.
      // Labeled groups become role=group containers labelled by their heading
      // (aria-labelledby); ungrouped options stay direct listbox children.
      // Option ids (o<i>) and data-i stay FLAT across groups — nav is by index.
      this.#pop.replaceChildren();
      // Group boundaries key on the SOURCE group element's identity, not its label
      // text — two ADJACENT groups with identical labels are two role=group
      // containers, like two native <optgroup>s (the label string is display-only).
      let lastSrc, grpBox = null, gi = 0;
      list.forEach((o, i) => {
        if (o.grpEl !== lastSrc) {
          if (o.grpEl && o.group) {
            const h = document.createElement('div');
            h.className = 'grp'; h.id = `g${gi}`; h.textContent = o.group;
            grpBox = document.createElement('div');
            grpBox.setAttribute('role', 'group');
            grpBox.setAttribute('aria-labelledby', `g${gi}`);
            grpBox.append(h);
            this.#pop.append(grpBox);
            gi++;
          } else grpBox = null;
        }
        lastSrc = o.grpEl;
        const d = document.createElement('div');
        d.className = 'opt'; d.setAttribute('part', 'option'); d.id = `o${i}`;
        d.dataset.i = i; d.setAttribute('role', 'option');
        if (o.disabled) d.setAttribute('aria-disabled', 'true');
        const txt = document.createElement('span'); txt.textContent = o.label; // display text — label attr overrides
        const mark = document.createElement('span');
        mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = '✓';
        d.append(txt, mark);
        (grpBox ?? this.#pop).append(d);
      });
      // Ask for reset (the spec algorithm) on the FIRST adoption of pure tags —
      // what a freshly parsed <select> does: nothing selected → the first
      // NON-DISABLED option; several [selected] → the last one wins. An UPGRADE
      // skips it (the wrapped native already resolved its own selection, and a
      // live -1 from a pre-upgrade script CLEAR must stay -1), and so does every
      // later adoption unless its records ask for one (#replay) — native only
      // resets on membership changes, so a -1 survives attribute/text edits.
      if (reset || (!this.#adopted && !upgrading)) this.#askForReset(list);
      // One-shot value attribute: applicable until the first adoption that
      // actually FINDS options (a register-before-markup connect adopts zero
      // children — the attribute must survive until the options stream in), and
      // never once a selection has been WRITTEN. Consumed only by an
      // option-bearing adoption. It outranks everything above (documented
      // extension semantics, incl. an inserted [selected] carrier and a wrapped
      // native's pre-upgrade script write — header contract) and selects
      // through the same per-option path, WITHOUT dirtying: it is a default,
      // so a later [selected] change still moves a pristine control.
      const attrV = this.getAttribute('value');
      if (attrV !== null && this.#attrPending && !this.#written) {
        const i = list.findIndex(o => o.value === attrV);
        if (i >= 0) this.#selectEl(list, i, false);
      }
      if (list.length) this.#attrPending = false;
      // The selection IS the live per-option selectedness — no attribute scan.
      // (reduce, not findLastIndex — Firefox 93–103 are in the support matrix;
      // ask-for-reset leaves at most one, so the last is the one.)
      const sel = list.reduce((a, o, i) => optState(o.el).selectedness ? i : a, -1);
      this.#adopted = true;
      this.#setIndex(sel);
      this.#syncDisabled();
      this.#syncLabel();
      // Drop records this fresh scan already consumed — our OWN adoption
      // mutations (the native force-disable above) and any leftovers from
      // mutations predating a direct #adopt call (lazy value-setter adoption,
      // reset). Replaying them would re-resolve against the post-adoption state
      // — e.g. a [selected] carrier record surviving a later .value write would
      // come back as 'force' and snap the selection off the written value.
      this.#mo.takeRecords();
    }

    /* Replay observer records IN ORDER against the live per-option state. Order
       matters: a MOVE arrives as a removal record PLUS an insertion record, and
       native runs the removal's ask-for-reset (landing on the first enabled
       option) BEFORE the re-insertion — reading only the final DOM would pick
       the wrong option. `list` is the freshly scanned FINAL option list. */
    #replay(recs, list) {
      if (!recs.length) return;
      const prevEls = this.#opts.map(o => o.el);
      const finalEls = list.map(o => o.el);
      const finalSet = new Set(finalEls);
      const known = new Set(prevEls); // options already adopted before these records
      // Ordering backbone over union(previous, final): the FINAL tree order,
      // with each REMOVED option spliced back in just before its nearest
      // surviving successor from the previous order (walked backwards so runs
      // of removals keep their relative order).
      // APPROXIMATION (documented boundary): an option's position in an
      // INTERMEDIATE state is taken to be its final one — exact for the
      // single-move / insert / remove batches that occur in practice, but a
      // multi-move batch could order an intermediate state differently from the
      // real DOM. An option inserted AND removed within one batch (in neither
      // list) is not modeled at all.
      const order = [...finalEls];
      for (let i = prevEls.length - 1; i >= 0; i--) {
        if (finalSet.has(prevEls[i])) continue;
        let at = order.length;
        for (let j = i + 1; j < prevEls.length; j++) {
          const k = order.indexOf(prevEls[j]);
          if (k >= 0) { at = k; break; }
        }
        order.splice(at, 0, prevEls[i]);
      }
      const live = new Set(prevEls);
      const dis = new Map(list.map(o => [o.el, o.disabled]));
      // A removed option is already out of the DOM, so its group is unreachable
      // — its own [disabled] is all we can read (and it only matters while the
      // option is still `live` in an intermediate state).
      const disabled = el => dis.get(el) ?? (el.hasAttribute('disabled') ||
        !!(el.parentElement && isGrp(el.parentElement) && el.parentElement.hasAttribute('disabled')));
      const rows = () => order.filter(el => live.has(el)).map(el => ({ el, disabled: disabled(el) }));
      // Option elements at select/optgroup level within an added/removed
      // subtree. Content INSIDE an option is display text, never membership.
      const optsIn = n => n.nodeType !== 1 ? []
        : [...(isOpt(n) ? [n] : []), ...(n.querySelectorAll?.('mythical-option,option') ?? [])]
          .filter(el => finalSet.has(el) || known.has(el));
      const inOption = t => { for (let n = t; n; n = n.parentElement) if (known.has(n)) return true; return false; };
      for (const r of recs) {
        if (r.type === 'attributes') {
          // Only `selected` carries selection semantics — value/label/disabled
          // records just refresh the rebuilt list.
          if (r.attributeName !== 'selected' || !isOpt(r.target) || !live.has(r.target)) continue;
          const s = optState(r.target);
          // The content attribute is only the DEFAULT selectedness: once the
          // option is DIRTY (a user commit or a selection write touched it),
          // adding or removing [selected] does nothing at all.
          if (s.dirtiness) continue;
          const want = r.target.hasAttribute('selected');
          if (want === s.selectedness) continue; // no state change → nothing to reset
          s.selectedness = want;
          // Single select: an option becoming selected deselects every other
          // one. THIS is what makes a [selected] default added later beat an
          // earlier programmatic pick on a DIFFERENT (non-dirty) option —
          // probed unanimous on chromium/firefox/webkit for a non-first option;
          // see the differential tests for Firefox's index-0 deviation.
          if (want) for (const el of order) { if (el !== r.target && live.has(el)) optState(el).selectedness = false; }
          // An option losing its selectedness leaves a menu-list single select
          // with nothing selected — it re-picks the first selectable option
          // (probed, unanimous).
          else this.#askForReset(rows());
        } else if (r.type === 'childList' && !inOption(r.target)) {
          let changed = false;
          for (const n of r.removedNodes) for (const el of optsIn(n)) changed = live.delete(el) || changed;
          for (const n of r.addedNodes) for (const el of optsIn(n)) if (!live.has(el)) { live.add(el); changed = true; }
          // MEMBERSHIP changed → ask for reset at THIS point in the sequence.
          // (An option's CONTENT changing — text nodes, inline markup — is not
          // membership: native leaves even a -1 selection alone. Same for a
          // [selected]-attributed NON-option node: never a carrier.)
          if (changed) this.#askForReset(rows());
        }
      }
    }

    /* The spec's "ask for reset" for a single select over `rows` ({el, disabled}
       in tree order): nothing selected → select the first NON-DISABLED option;
       two or more selected → keep the LAST (so an inserted [selected] carrier
       beats a standing selection). With EVERY option disabled there is no
       selection at all — the spec picks "the first option … that is not
       disabled, IF ANY", and Chromium + Firefox agree (probed); WebKit alone
       selects the first option anyway — we follow the spec majority. */
    #askForReset(rows) {
      const on = rows.filter(o => optState(o.el).selectedness);
      if (!on.length) { const first = rows.find(o => !o.disabled); if (first) optState(first.el).selectedness = true; }
      else for (const o of on.slice(0, -1)) optState(o.el).selectedness = false;
    }

    /* Select row `i` (or nothing, at -1), deselecting all the others — the
       spec's "select an option, deselect others". `dirty` marks the newly
       selected option DIRTY: only the selected one, exactly like native — the
       options merely DESELECTED keep their dirtiness, so their [selected]
       attribute still writes their selectedness afterwards. */
    #selectEl(rows, i, dirty) {
      rows.forEach((o, n) => { optState(o.el).selectedness = n === i; });
      if (dirty && rows[i]) optState(rows[i].el).dirtiness = true;
    }

    /* ---- selection state ---- */
    // A user/programmatic SELECTION write (never an adoption): selects the
    // option, deselects the rest, marks the picked one dirty, and arms the
    // host-level #written latch that the one-shot value ATTRIBUTE defers to.
    #write(i, fire) { this.#written = true; this.#selectEl(this.#opts, i, true); this.#setIndex(i, fire); }
    #setIndex(i, fire = false) {
      this.#idx = i;
      const o = this.#opts[i];
      this.#labelEl.textContent = o ? o.label : ''; // display text — label attr overrides
      this.#pop.querySelectorAll('.opt').forEach(n =>
        n.setAttribute('aria-selected', String(+n.dataset.i === i)));
      // one-way host→native sync (header contract) — property write, fires no events
      if (this.#native) this.#native.selectedIndex = i;
      // Native form submission skips disabled options: a selected-but-disabled
      // option (directly or via its group — o.disabled folds both in) submits
      // NO form entry. Validity is untouched — required/valueMissing still
      // compute off the selection itself (incl. the placeholder rule below).
      const fv = o && !o.disabled ? o.value : null;
      this.#internals.setFormValue(fv);
      this.#lastFormValue = fv; // the entry this host contributes to a formdata event (see #onFormdata)
      this.#updateValidity();
      if (fire) {
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }
    }
    #commit(i) { this.#touched = true; this.#write(i, i !== this.#idx); this.#close(); this.#btn.focus(); }

    /* ---- open/close/keyboard ---- */
    #toggle() { if (this.#btn.disabled) return; this.#open ? this.#close() : this.#openList(); }
    #openList() {
      if (!this.#opts.length) return;
      this.#open = true; this.#pop.hidden = false;
      // Viewport-aware: open upward when the list would clip below but fits above
      // (need = list height + the 6px anchor gap in the #pop rules + 2px breathing).
      const b = this.#btn.getBoundingClientRect(), need = this.#pop.offsetHeight + 8;
      this.toggleAttribute('data-flip',
        b.bottom + need > document.documentElement.clientHeight && b.top - need > 0);
      this.toggleAttribute('data-open', true);
      this.#btn.setAttribute('aria-expanded', 'true');
      this.#setActive(this.#idx >= 0 ? this.#idx : this.#step(-1, 1));
      document.addEventListener('pointerdown', this.#onDocDown, true);
    }
    #close() {
      if (!this.#open) return;
      this.#open = false; this.#pop.hidden = true;
      this.removeAttribute('data-open');
      this.#btn.setAttribute('aria-expanded', 'false');
      this.#btn.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', this.#onDocDown, true);
    }
    #setActive(i) {
      // While navigating, aria-selected stays on the COMMITTED option — selection-
      // follows-focus is optional listbox semantics; ours mirrors native commit-on-
      // close, and the active option is conveyed by aria-activedescendant instead.
      if (i < 0) return;
      this.#act = i;
      this.#pop.querySelectorAll('.opt').forEach(n => n.toggleAttribute('data-active', +n.dataset.i === i));
      this.#btn.setAttribute('aria-activedescendant', `o${i}`);
      this.#pop.querySelector(`#o${i}`)?.scrollIntoView({ block: 'nearest' });
    }
    #step(from, dir) { // next enabled index in direction, or stay
      for (let i = from + dir; i >= 0 && i < this.#opts.length; i += dir)
        if (!this.#opts[i].disabled) return i;
      return from >= 0 ? from : -1;
    }
    #onKey(e) {
      const k = e.key;
      if (!this.#open) {
        if (['ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(k)) { e.preventDefault(); this.#openList(); return; }
        if (k === 'Home' || k === 'End') { // APG: open with the first/last enabled option active — commits nothing
          e.preventDefault(); this.#openList();
          this.#setActive(k === 'Home' ? this.#step(-1, 1) : this.#step(this.#opts.length, -1));
          return;
        }
      } else {
        if (k === 'Escape') { e.preventDefault(); this.#close(); return; }
        if (k === 'Enter' || k === ' ') { e.preventDefault(); if (this.#act >= 0) this.#commit(this.#act); return; }
        // APG chord — open + Alt+ArrowUp commits the active option and closes;
        // handled BEFORE ordinary ArrowUp so the chord never just moves active.
        if (k === 'ArrowUp' && e.altKey) {
          e.preventDefault();
          if (this.#act >= 0) this.#commit(this.#act); else this.#close();
          return;
        }
        if (k === 'ArrowDown') { e.preventDefault(); this.#setActive(this.#step(this.#act, 1)); return; }
        if (k === 'ArrowUp') { e.preventDefault(); this.#setActive(this.#step(this.#act, -1)); return; }
        if (k === 'Home') { e.preventDefault(); this.#setActive(this.#step(-1, 1)); return; }
        if (k === 'End') { e.preventDefault(); this.#setActive(this.#step(this.#opts.length, -1)); return; }
        if (k === 'PageDown' || k === 'PageUp') { // OPEN only: jump 10 enabled options,
          // clamped at the first/last enabled. Closed PageUp/PageDown is deliberately
          // NOT handled (falls through to nothing) — native <select> parity.
          e.preventDefault();
          const dir = k === 'PageDown' ? 1 : -1;
          let i = this.#act;
          for (let n = 0; n < 10; n++) { const nx = this.#step(i, dir); if (nx === i) break; i = nx; }
          this.#setActive(i);
          return;
        }
        if (k === 'Tab') { // commit like Enter, but no preventDefault — focus moves on
          if (this.#act >= 0) { this.#touched = true; this.#write(this.#act, this.#act !== this.#idx); }
          this.#close(); return;
        }
      }
      // typeahead — CLOSED typeahead commits without opening: native <select>
      // parity (deliberate). Printable keys carrying Ctrl/Alt/Meta are browser
      // shortcuts (Ctrl+C, Cmd+F…) — they must never typeahead-commit. The
      // modifier bail applies ONLY to this branch: the Alt+Arrow chords above
      // (and closed Alt+ArrowDown → open, via the include list) stay live.
      if (k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now();
        this.#ta = (now - this.#taT < 600 ? this.#ta : '') + k.toLowerCase(); this.#taT = now;
        // A SINGLE-character buffer — one press, or the same character repeated
        // ("a", "aa", "aaa"…) — CYCLES: search from just past the current active
        // (open) / selected (closed) option for the next option starting with that
        // character, wrapping around — native parity ("ash" selected, press "a" →
        // "aspen" commits). Multi-character DISTINCT prefixes keep from-start
        // prefix matching.
        const cycle = this.#ta.length === 1 || [...this.#ta].every(c => c === this.#ta[0]);
        let i = -1;
        if (cycle) {
          const from = this.#open ? this.#act : this.#idx, n = this.#opts.length;
          for (let s = 1; s <= n; s++) {
            const j = (from + s + n) % n, o = this.#opts[j];
            if (!o.disabled && o.label.toLowerCase().startsWith(this.#ta[0])) { i = j; break; }
          }
        } else {
          i = this.#opts.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(this.#ta));
        }
        if (i >= 0) this.#open ? this.#setActive(i) : this.#commit(i);
      }
    }

    /* ---- native-parity API ----
       Option-dependent members #drain() pending option mutations first (the
       observer is async, native option lists are synchronous) — a same-task
       append + value write/read resolves against the fresh list, not stale
       #opts that the later observer callback would then "correct". */
    get type() { return 'select-one'; }
    get value() { this.#drain(); return this.#opts[this.#idx]?.value ?? ''; }
    // Pre-connect writes (never-adopted element): adopt synchronously first — the
    // child scan works while disconnected — so the write resolves against the real
    // option list instead of an empty one; the connect-time re-adoption then keeps
    // the chosen value via the dirty-preservation path.
    set value(v) { this.#drain(); if (!this.#adopted) this.#adopt(); this.#write(this.#opts.findIndex(o => o.value === String(v)), false); }
    get selectedIndex() { this.#drain(); return this.#idx; }
    // WebIDL long conversion like native ('1' and 1.9 both mean index 1,
    // NaN/Infinity → 0); out-of-range still clears the selection to -1.
    set selectedIndex(i) { this.#drain(); if (!this.#adopted) this.#adopt(); const n = toLong(i); this.#write(this.#opts[n] ? n : -1, false); }
    // snapshot reports CURRENT selectedness, not the adoption-time [selected] flag
    // (the internal source-element/group-element references stay private — the
    // group LABEL string remains exposed as `group`)
    get options() { this.#drain(); return this.#opts.map(({ el: _el, grpEl: _grpEl, ...o }, index) => ({ ...o, index, selected: index === this.#idx })); }
    item(i) { this.#drain(); const n = toLong(i); return (n < 0 ? null : this.options[n]) ?? null; } // unsigned long: negatives → null
    get length() { this.#drain(); return this.#opts.length; }
    get name() { return this.getAttribute('name') ?? ''; }
    set name(v) { this.setAttribute('name', v); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(v) { this.toggleAttribute('disabled', !!v); }
    get required() { return this.hasAttribute('required'); }
    set required(v) { this.toggleAttribute('required', !!v); }
    get form() { return this.#internals.form; }
    get labels() { return this.#internals.labels; }
    // The validity-facing members #drain() too: option mutations feed validity
    // (placeholder shape, disabled state, membership), and native constraint
    // validation sees them synchronously — a same-task mutate-then-check must
    // not read the stale pre-observer internals state.
    get validity() { this.#drain(); return this.#internals.validity; }
    get validationMessage() { this.#drain(); return this.#internals.validationMessage; }
    get willValidate() { this.#drain(); return this.#internals.willValidate; }
    checkValidity() { this.#drain(); return this.#internals.checkValidity(); }
    reportValidity() { this.#drain(); this.#touched = true; this.#updateValidity(); return this.#internals.reportValidity(); }
    setCustomValidity(msg) {
      // WebIDL DOMString conversion (native parity): EVERY argument
      // stringifies — setCustomValidity(0) sets the error "0" (invalid),
      // null sets "null"; only the empty STRING clears. The argument is
      // required — a zero-arg call throws a TypeError like native.
      if (arguments.length === 0)
        throw new TypeError("Failed to execute 'setCustomValidity' on 'MythicalSelect': 1 argument required, but only 0 present.");
      this.#customError = String(msg);
      this.#updateValidity();
    }

    /* ---- form lifecycle ---- */
    // Track the associated form for the formdata reconciliation listener (see
    // #onFormdata): ONE listener per association, detached from the previous
    // form on re-association (and on disassociation — the callback fires with
    // null), so a departed control never edits a stranger form's entries.
    // CAPTURE phase: the reconciler must correct the entry list BEFORE any
    // author `formdata` listener reads it — a bubble-phase reconciler would let
    // listeners registered earlier observe our stale entry, where a native
    // select would already expose the fresh value.
    formAssociatedCallback(form) {
      if (this.#form) this.#form.removeEventListener('formdata', this.#onFormdata, true);
      this.#form = form ?? null;
      if (form) form.addEventListener('formdata', this.#onFormdata, true);
      this.#syncLabel();
    }
    // The spec's form-reset for a select: every option's selectedness goes back
    // to its DEFAULT (its [selected] attribute), every option's dirtiness
    // clears — then ask for reset (run by #adopt).
    formResetCallback() {
      for (const o of this.#opts) {
        const s = optState(o.el);
        s.selectedness = o.el.hasAttribute('selected');
        s.dirtiness = false;
      }
      this.#adopted = false; this.#touched = false; this.#written = false; this.#attrPending = true;
      this.#adopt({ reset: true });
    }
    formDisabledCallback(d) { this.toggleAttribute('data-form-disabled', d); this.#syncDisabled(); }
    formStateRestoreCallback(state) { if (typeof state === 'string') this.value = state; }

    #syncDisabled() {
      this.#btn.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
      if (this.#btn.disabled) this.#close();
    }
    /* Delegated activation bridge for the wrapped native's OWN labels
       (native.labels — for/id and wrapping associations both), so author markup
       that labels the INNER select keeps working after upgrade — including
       labels added or retargeted AFTER adoption, which per-label binding at
       adoption time would miss. ONE click listener on the host's root document,
       bound while a native is adopted; removed on departure AND on host
       disconnect, re-bound on reconnect while still adopted. Idempotent per
       document (rebinding never stacks duplicates). No preventDefault — the
       label's own activation targets the force-disabled native and goes
       nowhere. */
    #bindLabelBridge() {
      // Bind on the ROOT NODE, not ownerDocument: inside an ancestor shadow
      // root a click is retargeted to the shadow HOST before it reaches the
      // document, so a document listener can never see the <label> itself.
      const doc = this.getRootNode();
      if (this.#labelDoc === doc) return;
      this.#unbindLabelBridge();
      doc.addEventListener('click', this.#onLabelClick);
      this.#labelDoc = doc;
    }
    #unbindLabelBridge() {
      if (!this.#labelDoc) return;
      this.#labelDoc.removeEventListener('click', this.#onLabelClick);
      this.#labelDoc = null;
    }
    #syncLabel() {
      // aria-labelledby cannot cross the shadow boundary, so mirror the associated
      // external labels' text onto the trigger as its accessible NAME. The selected-
      // option text in #label is the combobox VALUE (and the fallback name when no
      // label exists — then no aria-label is set). A WRAPPING label contains the
      // host itself — walk the label recursively, skipping the host node (and with
      // it our whole subtree, so option text never leaks into the name) but KEEPING
      // surrounding text at any depth, e.g. <label><span>Mode <host/> required
      // </span></label> → "Mode required". Whitespace-normalized; recomputed on
      // focusin (constructor) so it is fresh when announced.
      // Pragmatic accname SUBSET (a deliberate approximation — no aria-labelledby
      // or aria-label resolution inside the label, no role-based pruning): skip
      // aria-hidden="true" and [hidden] subtrees entirely, and take an <img>'s
      // alt text instead of descending it.
      const textOf = n => {
        if (n === this) return '';
        if (n.nodeType === Node.TEXT_NODE) return n.textContent;
        if (n.nodeType !== Node.ELEMENT_NODE) return '';
        if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden')) return '';
        if (n.localName === 'img') return n.getAttribute('alt') ?? '';
        return [...n.childNodes].map(textOf).join('');
      };
      const norm = s => s.replace(/\s+/g, ' ').trim();
      // EXPLICIT naming attributes outrank the label mirror (accname precedence):
      // aria-labelledby idrefs resolve in the element's ROOT NODE (getRootNode —
      // document or surrounding shadow root) and their text goes through the
      // SAME accname-subset walk; aria-label is taken verbatim. Applied to the
      // host first, then to the wrapped native (progressive markup commonly
      // names the inner select). First non-empty tier wins:
      //   (1) host aria-labelledby  (2) host aria-label
      //   (3) native aria-labelledby / aria-label  (4) associated-<label> text.
      const explicit = el => {
        const ids = el.getAttribute('aria-labelledby');
        if (ids !== null) {
          const root = el.getRootNode();
          const byRef = ids.split(/\s+/).filter(Boolean)
            .map(id => { const n = root.getElementById?.(id); return n ? norm(textOf(n)) : ''; })
            .filter(Boolean).join(' ');
          if (byRef) return byRef;
        }
        const al = el.getAttribute('aria-label');
        return al && al.trim() ? al : '';
      };
      let t = explicit(this) || (this.#native ? explicit(this.#native) : '');
      if (!t) {
        // Progressive markup commonly labels the INNER select (<label for> its id,
        // or a wrapping label whose first labelable descendant it is) — after
        // upgrade those labels are orphaned (the native is force-disabled and
        // hidden), so their text joins the mirrored name: host-targeting labels
        // first, then native-targeting, deduped (the same label element counted
        // once), through the SAME accname-subset walk.
        const hostLabels = [...this.#internals.labels];
        const nativeLabels = [...this.#native?.labels ?? []].filter(l => !hostLabels.includes(l));
        t = [...hostLabels, ...nativeLabels]
          .map(l => norm(textOf(l)))
          .filter(Boolean).join(' ');
      }
      t ? this.#btn.setAttribute('aria-label', t) : this.#btn.removeAttribute('aria-label');
    }
    #updateValidity() {
      // Native valueMissing is PLACEHOLDER-ONLY: a required select is valueMissing
      // when the SELECTED option is the placeholder label option — the FIRST
      // option, a DIRECT child (not inside a group), with value "". Selecting any
      // OTHER empty-valued option is a legitimate choice (native parity); no
      // selection at all (idx < 0) stays missing.
      const first = this.#opts[0];
      const req = this.hasAttribute('required');
      const missing = req &&
        (this.#idx < 0 || (this.#idx === 0 && first.value === '' && !first.grpEl));
      // Flags COMBINE like native (a required placeholder + a custom error →
      // BOTH customError and valueMissing true); the message prefers the custom
      // text, else the valueMissing one.
      const flags = { customError: !!this.#customError, valueMissing: missing };
      if (flags.customError || flags.valueMissing)
        this.#internals.setValidity(flags,
          this.#customError || 'Please select an item in the list.', this.#btn);
      else this.#internals.setValidity({});
      // AX states on the shadow trigger (the role=combobox the host attribute
      // can't reach): aria-required mirrors the required attribute (runs on
      // attributeChangedCallback AND every adoption — both funnel here);
      // aria-invalid holds exactly while the [data-user-invalid] condition does.
      if (req) this.#btn.setAttribute('aria-required', 'true');
      else this.#btn.removeAttribute('aria-required');
      // :user-invalid fallback for engines without it on form-associated elements.
      const bad = this.#touched && !this.#internals.validity.valid;
      this.toggleAttribute('data-user-invalid', bad);
      if (bad) this.#btn.setAttribute('aria-invalid', 'true');
      else this.#btn.removeAttribute('aria-invalid');
    }
  }

  if (!customElements.get('mythical-select')) customElements.define('mythical-select', MythicalSelect);
})();
