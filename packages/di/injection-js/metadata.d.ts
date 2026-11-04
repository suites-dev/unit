import '@suites/types.di';
import type { InjectionToken } from 'injection-js';

declare module '@suites/types.di' {
  interface IdentifierMetadataRegistry {
    injectionjs: never;
  }

  interface InjectableIdentifierRegistry<T> {
    injectionjs: InjectionToken<T>;
  }
}
