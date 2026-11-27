import { isDeepStrictEqual } from 'node:util';
import type { FinalValue } from '@suites/types.common';
import type { StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';

export interface DependencyPathEntry {
  readonly identifier: InjectableIdentifier;
  readonly metadata: IdentifierMetadata | undefined;
}

export type CompositionBoundary = DependencyPathEntry &
  (
    | { readonly kind: 'mock'; readonly value: StubbedInstance<unknown> }
    | { readonly kind: 'final'; readonly value: FinalValue }
    | {
        readonly kind: 'guard';
        readonly create: (path: readonly DependencyPathEntry[]) => FinalValue;
      }
  );

export interface CompositionBoundaryLookup {
  resolve(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): CompositionBoundary | undefined;
}

export class CompositionBoundaryContainer implements CompositionBoundaryLookup {
  public constructor(private readonly boundaries: readonly CompositionBoundary[]) {}

  public resolve(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): CompositionBoundary | undefined {
    return matchDeclaration(this.boundaries, identifier, metadata);
  }

  public list(): readonly CompositionBoundary[] {
    return this.boundaries;
  }
}

export function matchDeclaration<T extends DependencyPathEntry>(
  declarations: readonly T[],
  identifier: InjectableIdentifier,
  metadata: IdentifierMetadata | undefined
): T | undefined {
  const candidates = declarations.filter((entry) => entry.identifier === identifier);
  return (
    candidates.find((entry) => isDeepStrictEqual(entry.metadata, metadata)) ??
    candidates.find((entry) => entry.metadata === undefined)
  );
}
