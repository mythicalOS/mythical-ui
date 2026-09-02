/* Hand-written type declarations for mythical-select.js.
 *
 * The module has NO named exports. Importing it registers the custom elements
 * as a side effect:
 *
 *   import '@mythicalos/ui-core/select';
 *   // defines <mythical-select>, <mythical-option>, <mythical-optgroup>
 *
 * The element class is therefore not importable; at runtime it is reachable
 * only through the registry:
 *
 *   const Ctor = customElements.get('mythical-select') as
 *     MythicalSelectElementConstructor | undefined;
 *
 * The names below are ambient INTERFACES (types only — no global constructor
 * values exist; `new MythicalSelectElement()` is deliberately a type error).
 * Construct via `document.createElement` or markup, or `new` the constructor
 * obtained from `customElements.get()` typed as the *Constructor interface.
 *
 * Attributes:  name · value · disabled · required · variant="chip" (compact
 *              policy-chip look). Form association is automatic.
 * Events:      'input' and 'change' (plain Events, bubbling + composed) fire on
 *              user commits only — programmatic value/selectedIndex writes fire
 *              nothing, like native <select>.
 * Not supported (use a native <select>): multiple, size (listbox mode).
 */

declare global {

/** Immutable snapshot of one option, as returned by `options` / `item(i)`. */
interface MythicalSelectOption {
  /** Canonical value — falls back to the whitespace-collapsed text, like native. */
  readonly value: string;
  readonly text: string;
  /** Display text — the `label` attribute when present, otherwise `text`. */
  readonly label: string;
  readonly disabled: boolean;
  /** True when this option is the CURRENTLY selected one (at snapshot time),
   *  not the adoption-time `[selected]` default. */
  readonly selected: boolean;
  /** The `label` of the owning optgroup, or null when ungrouped. */
  readonly group: string | null;
  readonly index: number;
}

/**
 * `<mythical-select>` — form-associated, native-parity styled single select.
 * Register by importing the module; construct via `document.createElement`
 * or markup, not `new` (no global constructor value exists — see
 * `MythicalSelectElementConstructor`).
 */
interface MythicalSelectElement extends HTMLElement {
  /** Always 'select-one', like a native single select. */
  readonly type: 'select-one';

  /** Current value ('' when nothing is selected). Programmatic writes fire no events. */
  value: string;
  /** Index of the selected option, -1 for none. Programmatic writes fire no events. */
  selectedIndex: number;
  /** Snapshot array of the current options (not live, unlike native HTMLOptionsCollection). */
  readonly options: ReadonlyArray<MythicalSelectOption>;
  /** Snapshot of the option at `index`, or null when out of range. */
  item(index: number): MythicalSelectOption | null;
  /** Number of options. */
  readonly length: number;

  /** Reflects the `name` attribute (form submission key). */
  name: string;
  /** Reflects the `disabled` attribute. */
  disabled: boolean;
  /** Reflects the `required` attribute. */
  required: boolean;

  /** Owning form, via ElementInternals. */
  readonly form: HTMLFormElement | null;
  /** Associated `<label>` elements, via ElementInternals. */
  readonly labels: NodeListOf<HTMLLabelElement>;

  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
}

/** `<mythical-option>` — inert data carrier child of `<mythical-select>`.
 *  Attributes: value · disabled · selected · label (overrides display text);
 *  option text is its text content (whitespace-collapsed, like native). */
interface MythicalOptionElement extends HTMLElement {}

/** `<mythical-optgroup>` — inert option-group wrapper.
 *  Attributes: label · disabled. */
interface MythicalOptgroupElement extends HTMLElement {}

/** Constructor type for `<mythical-select>` — reachable at runtime ONLY through
 *  the registry: `customElements.get('mythical-select') as
 *  MythicalSelectElementConstructor | undefined`. */
interface MythicalSelectElementConstructor { new (): MythicalSelectElement }

/** Constructor type for `<mythical-option>` — via `customElements.get('mythical-option')`. */
interface MythicalOptionElementConstructor { new (): MythicalOptionElement }

/** Constructor type for `<mythical-optgroup>` — via `customElements.get('mythical-optgroup')`. */
interface MythicalOptgroupElementConstructor { new (): MythicalOptgroupElement }

interface HTMLElementTagNameMap {
  'mythical-select': MythicalSelectElement;
  'mythical-option': MythicalOptionElement;
  'mythical-optgroup': MythicalOptgroupElement;
}

}

export {};
