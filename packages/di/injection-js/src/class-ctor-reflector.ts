import 'reflect-metadata';
import { InjectionToken, ReflectiveInjector } from 'injection-js';
import type { Type } from '@suites/types.common';
import type { ClassInjectable, InjectableIdentifier } from '@suites/types.di';
import { UndefinedDependency, UndefinedDependencyError } from '@suites/types.di';

export type ClassCtorReflector = ReturnType<typeof ClassCtorReflector>;

/** Reads constructor dependencies without creating a production injector or running constructors. */
export function ClassCtorReflector() {
  function reflectInjectables(targetClass: Type): ClassInjectable[] {
    // Use InjectionJS's public resolver so token precedence, forward references,
    // static parameters and lowered decorator metadata follow its own semantics.
    let dependencies;
    try {
      dependencies = ReflectiveInjector.resolve([targetClass])[0].resolvedFactories[0].dependencies;
    } catch (error) {
      throw new UndefinedDependencyError(
        `Cannot inspect constructor dependencies of '${targetClass.name}'. ` +
          `Use @Inject(token) or enable decorator metadata. InjectionJS: ${String(error)}`
      );
    }

    return dependencies.map(({ key }, index) => {
      const token: unknown = key.token;
      if (
        typeof token !== 'function' &&
        typeof token !== 'string' &&
        typeof token !== 'symbol' &&
        !(token instanceof InjectionToken)
      ) {
        throw new UndefinedDependencyError(
          `Unsupported constructor token at index [${index}] in '${targetClass.name}'. ` +
            'Use a class, string, symbol, or InjectionToken.'
        );
      }

      return {
        // InjectionToken is registered in the consumer's /metadata entry point.
        identifier: token as InjectableIdentifier,
        value: typeof token === 'function' ? (token as Type) : UndefinedDependency,
        type: 'PARAM',
      };
    });
  }

  return { reflectInjectables };
}
