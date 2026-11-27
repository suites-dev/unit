import type { DependencyInjectionAdapter, InjectableRegistry } from '@suites/types.di';

const emptyRegistry = {
  list: () => [],
  resolve: () => undefined,
} satisfies InjectableRegistry;

export const adapter = {
  inspect: () => emptyRegistry,
} satisfies DependencyInjectionAdapter;
