/**
 * VOIDRUSH — immutable configuration helper.
 *
 * `Object.freeze` has an overload constrained to primitive property types,
 * which makes TypeScript infer literal types (`30` rather than `number`) for
 * config objects. That leaks into every field initialised from a constant. This
 * wrapper forces the general overload, so configuration values stay numbers
 * while remaining frozen at runtime.
 */
export function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}
