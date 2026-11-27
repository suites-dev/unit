import type { ClassMetadata } from '@inversifyjs/core';
import type { Type } from '@suites/types.common';
import type { ClassInjectable, InspectionFailure, IdentifierMetadata } from '@suites/types.di';
import { UndefinedDependency } from '@suites/types.di';
import { toInjectableMetadata } from './class-metadata.js';
import type { MetadataReflector } from './types.js';
import type { IdentifierBuilder } from './identifier-builder.static.js';

export type ClassCtorReflector = ReturnType<typeof ClassCtorReflector>;

export function ClassCtorReflector(
  reflector: MetadataReflector,
  identifierBuilder: IdentifierBuilder
) {
  function reflectInjectables(
    target: Type,
    metadata: ClassMetadata
  ): ClassInjectable<IdentifierMetadata>[] | InspectionFailure {
    const types: (Type | undefined)[] = reflector.getMetadata('design:paramtypes', target) ?? [];
    const injectables: ClassInjectable<IdentifierMetadata>[] = [];
    const count = Math.max(target.length, types.length, metadata.constructorArguments.length);
    for (let index = 0; index < count; index++) {
      const entry = metadata.constructorArguments[index];
      const result = identifierBuilder.toIdentifierObject(
        entry ? toInjectableMetadata(entry) : [],
        types[index] === Object ? undefined : types[index]
      );
      if (result.kind === 'failure') {
        return { ...result, target, location: { kind: 'parameter', index }, cause: undefined };
      }
      injectables.push({
        type: 'PARAM',
        identifier: result.identifier,
        metadata: result.metadata,
        value: types[index] ?? UndefinedDependency,
      } satisfies ClassInjectable<IdentifierMetadata>);
    }
    return injectables;
  }
  return { reflectInjectables };
}
