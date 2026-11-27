import { LazyServiceIdentifier } from 'inversify';
import type { Type } from '@suites/types.common';
import type { InjectableIdentifier } from '@suites/types.di';
import { INVERSIFY_PRESERVED_KEYS, type InversifyInjectableMetadata } from './types.js';

export type IdentifierBuilder = ReturnType<typeof IdentifierBuilder>;

export function IdentifierBuilder() {
  function toIdentifierObject(
    items: readonly InversifyInjectableMetadata[],
    type: Type | undefined
  ) {
    const entry = items.find(({ key }) => INVERSIFY_PRESERVED_KEYS.includes(key));
    const token = entry ? entry.value : type;
    const identifier = token instanceof LazyServiceIdentifier ? token.unwrap() : token;
    if (identifier === undefined) {
      return {
        kind: 'failure',
        reason: entry ? 'undefined-token' : 'undefined-dependency',
      } as const;
    }
    const tags = items.filter(({ key }) => !INVERSIFY_PRESERVED_KEYS.includes(key));
    return {
      kind: 'success' as const,
      identifier: identifier as InjectableIdentifier,
      metadata: tags.length
        ? Object.fromEntries(tags.map(({ key, value }) => [key, value]))
        : undefined,
    };
  }
  return { toIdentifierObject };
}
