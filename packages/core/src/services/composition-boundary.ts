import { isDeepStrictEqual } from 'node:util';
import type { FinalValue } from '@suites/types.common';
import type { StubbedInstance } from '@suites/types.doubles';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';

export interface DependencyPathEntry {
  identifier: InjectableIdentifier;
  metadata?: IdentifierMetadata;
}

export type CompositionBoundary =
  | {
      kind: 'mock';
      identifier: InjectableIdentifier;
      metadata?: IdentifierMetadata;
      value: StubbedInstance<unknown>;
    }
  | {
      kind: 'final';
      identifier: InjectableIdentifier;
      metadata?: IdentifierMetadata;
      value: FinalValue;
    }
  | {
      kind: 'guard';
      identifier: InjectableIdentifier;
      metadata?: IdentifierMetadata;
      create(path: readonly DependencyPathEntry[]): FinalValue;
    };

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
