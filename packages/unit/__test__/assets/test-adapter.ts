import type { DependencyInjectionAdapter, InjectableRegistry } from '@suites/types.di';

const emptyRegistry = {
  list: () => [],
  resolve: () => undefined,
} satisfies InjectableRegistry;

export const adapter = {
  inspect: () => ({ kind: 'success', registry: emptyRegistry }),
} satisfies DependencyInjectionAdapter;
