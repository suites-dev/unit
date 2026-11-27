import { getClassMetadata } from '@inversifyjs/core';
import { isDeepStrictEqual } from 'node:util';
import type { Type } from '@suites/types.common';
import type {
  DependencyInjectionAdapter,
  ClassInjectable,
  InspectionResult,
  InjectableIdentifier,
  WithMetadata,
} from '@suites/types.di';
import type { ClassPropsReflector } from './class-props-reflector.js';
import type { ClassCtorReflector } from './class-ctor-reflector.js';
import type { IdentifierMetadata } from './types.js';

export type DependenciesAdapter = (
  classPropsReflector: ClassPropsReflector,
  classCtorReflector: ClassCtorReflector
) => DependencyInjectionAdapter;

export function DependenciesAdapter(
  classPropsReflector: ClassPropsReflector,
  classCtorReflector: ClassCtorReflector
): DependencyInjectionAdapter {
  function inspect(targetClass: Type): InspectionResult {
    let metadata;
    try {
      metadata = getClassMetadata(targetClass);
    } catch (cause) {
      return {
        kind: 'failure',
        reason: 'invalid-metadata',
        target: targetClass,
        location: { kind: 'class' },
        cause,
      };
    }
    const ctorInjectables = classCtorReflector.reflectInjectables(targetClass, metadata);
    if (!Array.isArray(ctorInjectables)) return ctorInjectables;
    const propsInjectables = classPropsReflector.reflectInjectables(targetClass, metadata);
    if (!Array.isArray(propsInjectables)) return propsInjectables;
    const allInjectables = [...ctorInjectables, ...propsInjectables] as WithMetadata<never>[];

    return {
      kind: 'success',
      registry: {
        resolve(
          identifier: InjectableIdentifier,
          metadata: IdentifierMetadata | undefined
        ): ClassInjectable | undefined {
          const injectables = allInjectables.filter(
            ({ identifier: injectableIdentifier }) => injectableIdentifier === identifier
          );

          if (injectables.length === 0) {
            return undefined;
          }

          if (injectables.length === 1 && !metadata) {
            return injectables[0];
          }

          if (metadata) {
            return injectables.find(({ metadata: injectableMetadata }) =>
              isDeepStrictEqual(injectableMetadata, metadata)
            );
          }

          const foundInjectable = injectables.find(
            ({ identifier: injectableIdentifier, metadata: injectableMetadata }) =>
              identifier === injectableIdentifier && typeof injectableMetadata === 'undefined'
          );

          return foundInjectable ? foundInjectable : undefined;
        },
        list(): ClassInjectable[] {
          return allInjectables;
        },
      },
    };
  }

  return {
    inspect,
    canAutoConstruct: (targetClass: Type): boolean =>
      Reflect.getOwnMetadata('@inversifyjs/core/classIsInjectableFlagReflectKey', targetClass) ===
      true,
  };
}
