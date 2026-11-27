import type { Type } from '@suites/types.common';
import type { DependencyInjectionAdapter, InjectableIdentifier } from '@suites/types.di';
import { Injectable } from 'injection-js';
import type { ClassCtorReflector } from './class-ctor-reflector.js';

/**
 * Adapts constructor metadata to Suites' flat test container.
 * Contextual inject(), provider configuration and injector hierarchy are not supported.
 */
export function DependenciesAdapter(
  classCtorReflector: ClassCtorReflector
): DependencyInjectionAdapter {
  return {
    canAutoConstruct(targetClass: Type): boolean {
      const annotations: unknown = Reflect.getOwnMetadata('annotations', targetClass);
      return (
        Array.isArray(annotations) &&
        annotations.some((annotation: unknown) => annotation instanceof Injectable)
      );
    },
    inspect(targetClass: Type) {
      const injectables = classCtorReflector.reflectInjectables(targetClass);
      return {
        resolve(identifier: InjectableIdentifier) {
          return injectables.find((injectable) => injectable.identifier === identifier);
        },
        list() {
          return injectables;
        },
      };
    },
  };
}
