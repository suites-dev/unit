import { isDeepStrictEqual } from 'node:util';
import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { FinalValue, Type } from '@suites/types.common';
import type { StubbedInstance } from '@suites/types.doubles';
import type { IdentifierToMockOrFinal } from './dependency-container.js';

export class DependencyMap {
  private readonly resolvedDependencies: IdentifierToMockOrFinal[] = [];

  public has(identifier: InjectableIdentifier, metadata?: IdentifierMetadata): boolean {
    return this.resolvedDependencies.some(
      ([key]) => key.identifier === identifier && isDeepStrictEqual(key.metadata, metadata)
    );
  }

  public set(
    identifier: InjectableIdentifier,
    value: Type | StubbedInstance<unknown> | FinalValue,
    metadata?: IdentifierMetadata
  ): void {
    this.resolvedDependencies.push([{ identifier, metadata: metadata as never }, value]);
  }

  public get(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): Type | StubbedInstance<unknown> | FinalValue | undefined {
    return this.resolvedDependencies.find(
      ([key]) => key.identifier === identifier && isDeepStrictEqual(key.metadata, metadata)
    )?.[1];
  }

  public entries(): IdentifierToMockOrFinal[] {
    return this.resolvedDependencies;
  }
}
