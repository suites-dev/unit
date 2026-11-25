import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';

export function normalizeIdentifier(
  identifier: InjectableIdentifier,
  metadata: IdentifierMetadata | undefined = undefined
) {
  return { identifier, metadata } as const;
}
