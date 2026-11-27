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
    | { readonly kind: 'guard'; readonly create: (path: readonly DependencyPathEntry[]) => FinalValue }
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
    const matchingIdentifier = this.boundaries.filter(
      (boundary) => boundary.identifier === identifier
    );
    const exact = matchingIdentifier.find((boundary) =>
      isDeepStrictEqual(boundary.metadata, metadata)
    );

    if (exact !== undefined) {
      return exact;
    }

    return matchingIdentifier.find((boundary) => boundary.metadata === undefined);
  }

  public list(): readonly CompositionBoundary[] {
    return this.boundaries;
  }
}
