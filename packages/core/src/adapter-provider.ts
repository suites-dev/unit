/** An adapter may be supplied directly or resolved when compilation begins. */
export type AdapterProvider<T> = Promise<T> | (() => Promise<T>);

/** @internal Resolves a provider without starting discovery during builder creation. */
export function resolveAdapter<T>(provider: AdapterProvider<T>): Promise<T> {
  return typeof provider === 'function' ? provider() : provider;
}
