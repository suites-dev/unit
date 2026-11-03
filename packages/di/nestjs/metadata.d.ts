import '@suites/types.di';
import type { IdentifierMetadata as AdapterIdentifierMetadata } from './dist/esm/types.js';

declare module '@suites/types.di' {
  interface IdentifierMetadataRegistry {
    nestjs: AdapterIdentifierMetadata;
  }
}
