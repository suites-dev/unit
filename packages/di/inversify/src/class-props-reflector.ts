import type { ClassMetadata } from '@inversifyjs/core';
import type { Type } from '@suites/types.common';
import type { ClassInjectable, InspectionFailure, IdentifierMetadata } from '@suites/types.di';
import { UndefinedDependency } from '@suites/types.di';
import { toInjectableMetadata } from './class-metadata.js';
import type { MetadataReflector } from './types.js';
import type { IdentifierBuilder } from './identifier-builder.static.js';

export type ClassPropsReflector = ReturnType<typeof ClassPropsReflector>;

export function ClassPropsReflector(
  reflector: MetadataReflector,
  identifierBuilder: IdentifierBuilder
) {
  function reflectInjectables(
    target: Type,
    metadata: ClassMetadata
  ): ClassInjectable<IdentifierMetadata>[] | InspectionFailure {
    const injectables: ClassInjectable<IdentifierMetadata>[] = [];
    for (const [key, entry] of metadata.properties) {
      const type: Type | undefined = reflector.getMetadata('design:type', target.prototype, key);
      const result = identifierBuilder.toIdentifierObject(toInjectableMetadata(entry), type);
      if (result.kind === 'failure') {
        return { ...result, target, location: { kind: 'property', key }, cause: undefined };
      }
      injectables.push({
        type: 'PROPERTY',
        property: { key },
        identifier: result.identifier,
        metadata: result.metadata,
        value:
          type ??
          (typeof result.identifier === 'function' ? result.identifier : UndefinedDependency),
      } satisfies ClassInjectable<IdentifierMetadata>);
    }
    return injectables;
  }
  return { reflectInjectables };
}
