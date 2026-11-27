import type { Type } from '@suites/types.common';
import { INJECTABLE_WATERMARK } from '@nestjs/common/constants';
import type {
  DependencyInjectionAdapter,
  ClassInjectable,
  InspectionResult,
} from '@suites/types.di';
import type { ClassPropsReflector } from './class-props-reflector.js';
import type { ClassCtorReflector } from './class-ctor-reflector.js';

export function DependenciesAdapter(
  classPropsReflector: ClassPropsReflector,
  classCtorReflector: ClassCtorReflector
): DependencyInjectionAdapter {
  function inspect(targetClass: Type): InspectionResult {
    const ctorInjectables = classCtorReflector.reflectInjectables(targetClass);
    if (!Array.isArray(ctorInjectables)) return ctorInjectables;
    const propsInjectables = classPropsReflector.reflectInjectables(targetClass);
    if (!Array.isArray(propsInjectables)) return propsInjectables;
    const allInjectables = [...ctorInjectables, ...propsInjectables];

    return {
      kind: 'success',
      registry: {
        resolve(identifier: Type | string): ClassInjectable | undefined {
          return allInjectables.find(({ identifier: typeOrToken }) => typeOrToken === identifier);
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
      Reflect.getOwnMetadata(INJECTABLE_WATERMARK, targetClass) === true,
  };
}
