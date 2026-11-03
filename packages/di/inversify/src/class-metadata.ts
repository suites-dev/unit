import { ClassElementMetadataKind, type ClassElementMetadata } from '@inversifyjs/core';
import type { InversifyInjectableMetadata } from './types.js';

/** Convert Inversify's public metadata model into Suites injection metadata. */
export function toInjectableMetadata(
  metadata: ClassElementMetadata
): InversifyInjectableMetadata[] {
  if (metadata.kind === ClassElementMetadataKind.unmanaged) {
    return [{ key: 'unmanaged', value: true }];
  }

  const entries: InversifyInjectableMetadata[] = [
    {
      key: metadata.kind === ClassElementMetadataKind.multipleInjection ? 'multi_inject' : 'inject',
      value: metadata.value,
    },
  ];
  if (metadata.name !== undefined) {
    entries.push({ key: 'named', value: metadata.name });
  }
  for (const [key, value] of metadata.tags) {
    entries.push({ key: typeof key === 'number' ? String(key) : key, value });
  }
  return entries;
}
