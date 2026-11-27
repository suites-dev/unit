import { PROPERTY_DEPS_METADATA } from '@nestjs/common/constants';
import type { ClassInjectable, InspectionFailure } from '@suites/types.di';
import { UndefinedDependency } from '@suites/types.di';
import type { Type } from '@suites/types.common';
import type { MetadataReflector, ReflectedProperty } from './types.js';
import { resolveToken } from './params-token-resolver.js';

export type ClassPropsReflector = ReturnType<typeof ClassPropsReflector>;

export function ClassPropsReflector(reflector: MetadataReflector) {
  function reflectInjectables(target: Type): ClassInjectable[] | InspectionFailure {
    const properties: ReflectedProperty[] =
      reflector.getMetadata(PROPERTY_DEPS_METADATA, target) ?? [];
    const injectables: ClassInjectable[] = [];
    for (const { key, type: token } of properties) {
      const type: Type | undefined = reflector.getMetadata('design:type', target.prototype, key);
      const identifier = resolveToken(token);
      if (identifier === undefined) {
        return {
          kind: 'failure',
          reason: token === undefined ? 'undefined-dependency' : 'undefined-token',
          target,
          location: { kind: 'property', key },
          cause: undefined,
        };
      }
      const value =
        type === undefined
          ? UndefinedDependency
          : typeof identifier === 'string'
            ? type
            : identifier;
      injectables.push({
        type: 'PROPERTY',
        identifier,
        value,
        property: { key },
      } satisfies ClassInjectable);
    }
    return injectables;
  }
  return { reflectInjectables };
}
