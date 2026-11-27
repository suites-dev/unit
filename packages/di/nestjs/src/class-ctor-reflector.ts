import { SELF_DECLARED_DEPS_METADATA, PARAMTYPES_METADATA } from '@nestjs/common/constants';
import type { ClassInjectable, InspectionFailure } from '@suites/types.di';
import { UndefinedDependency } from '@suites/types.di';
import type { Type } from '@suites/types.common';
import type { MetadataReflector } from './types.js';
import { type NestCustomToken, resolveToken } from './params-token-resolver.js';

export type ClassCtorReflector = ReturnType<typeof ClassCtorReflector>;

export function ClassCtorReflector(reflector: MetadataReflector) {
  function reflectInjectables(target: Type): ClassInjectable[] | InspectionFailure {
    const types: (Type | undefined)[] = reflector.getMetadata(PARAMTYPES_METADATA, target) ?? [];
    const tokens: NestCustomToken[] =
      reflector.getMetadata(SELF_DECLARED_DEPS_METADATA, target) ?? [];
    const slots = tokens.reduce(
      (count, token) => Math.max(count, token.index + 1),
      Math.max(target.length, types.length)
    );
    const injectables: ClassInjectable[] = [];

    for (let index = 0; index < slots; index++) {
      const type = types[index];
      const token = tokens.find((entry) => entry.index === index);
      const identifier = token ? resolveToken(token.param) : type;
      if (identifier === undefined || (!token && identifier === Object)) {
        return {
          kind: 'failure',
          reason: token ? 'undefined-token' : 'undefined-dependency',
          target,
          location: { kind: 'parameter', index },
          cause: undefined,
        };
      }
      const value =
        type === undefined
          ? UndefinedDependency
          : typeof identifier === 'string'
            ? type
            : identifier;
      injectables.push({ type: 'PARAM', identifier, value } satisfies ClassInjectable);
    }
    return injectables;
  }
  return { reflectInjectables };
}
