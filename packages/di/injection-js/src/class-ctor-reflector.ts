import 'reflect-metadata';
import { Inject, InjectionToken, ReflectiveInjector, resolveForwardRef } from 'injection-js';
import type { Type } from '@suites/types.common';
import type { ClassInjectable, InjectableIdentifier, InspectionFailure } from '@suites/types.di';
import { UndefinedDependency } from '@suites/types.di';

export type ClassCtorReflector = ReturnType<typeof ClassCtorReflector>;

interface LoweredDecorator {
  readonly type: Type;
  readonly args: readonly unknown[] | undefined;
}

interface LoweredParameter {
  readonly type: Type | undefined;
  readonly decorators: readonly LoweredDecorator[] | undefined;
}

function annotations(type: Type | undefined, decorators: readonly unknown[]): readonly unknown[] {
  return type && type !== Object ? [type, ...decorators] : decorators;
}

// InjectionJS supports static parameters, lowered decorators, and emitted Reflect metadata,
// in that order. Read each slot once so lazy tokens have the same identity as in production.
function parameters(target: Type): readonly unknown[] | undefined {
  if (Object.prototype.hasOwnProperty.call(target, 'parameters') && 'parameters' in target) {
    const slots = target.parameters;
    if (Array.isArray(slots)) return slots;
  }

  if (
    Object.prototype.hasOwnProperty.call(target, 'ctorParameters') &&
    'ctorParameters' in target
  ) {
    const source = target.ctorParameters;
    const lowered: readonly LoweredParameter[] = typeof source === 'function' ? source() : source;
    return lowered.map((slot) =>
      annotations(
        slot?.type,
        (slot?.decorators ?? []).map(({ type, args }) => {
          const decorator = 'annotationCls' in type ? (type.annotationCls as Type) : type;
          return new decorator(...(args ?? []));
        })
      )
    );
  }

  const args: unknown[][] | undefined = Reflect.getOwnMetadata('parameters', target);
  const types: Type[] | undefined = Reflect.getOwnMetadata('design:paramtypes', target);
  if (!args && !types) return undefined;
  return Array.from({ length: types?.length ?? args?.length ?? 0 }, (_, index) =>
    annotations(types?.[index], args?.[index] ?? [])
  );
}

function injectable(
  target: Type,
  index: number,
  token: unknown
): ClassInjectable | InspectionFailure {
  if (
    typeof token !== 'function' &&
    typeof token !== 'string' &&
    typeof token !== 'symbol' &&
    !(token instanceof InjectionToken)
  ) {
    return {
      kind: 'failure',
      reason: 'unsupported-token',
      target,
      location: { kind: 'parameter', index },
      cause: undefined,
    };
  }
  return {
    identifier: token as InjectableIdentifier,
    value: typeof token === 'function' ? (token as Type) : UndefinedDependency,
    type: 'PARAM',
  };
}

function inspectParameter(
  target: Type,
  index: number,
  slot: unknown
): ClassInjectable | InspectionFailure {
  // The last type or explicit token wins; resolution modifiers do not change its identity.
  const candidates: readonly unknown[] = Array.isArray(slot) ? slot : [slot];
  let selected: unknown;
  for (const entry of candidates) {
    if (typeof entry === 'function' || entry instanceof Inject || entry instanceof InjectionToken)
      selected = entry;
  }
  if (!Array.isArray(slot) && slot != null) selected = slot;
  const explicit = selected instanceof Inject;
  // A user callback that throws must retain its exception identity.
  const resolved: unknown = resolveForwardRef(
    selected instanceof Inject ? selected.token : selected
  );
  const undefinedToken = resolved === undefined && (explicit || typeof selected === 'function');
  try {
    const [provider] = ReflectiveInjector.resolve([
      { provide: target, useFactory: () => undefined, deps: [[new Inject(resolved)]] },
    ]);
    return injectable(target, index, provider.resolvedFactories[0].dependencies[0].key.token);
  } catch (cause) {
    return {
      kind: 'failure',
      reason: undefinedToken ? 'undefined-token' : 'undefined-dependency',
      target,
      location: { kind: 'parameter', index },
      cause,
    };
  }
}

/** Reads constructor metadata without running the constructor or creating an injector. */
export function ClassCtorReflector() {
  function reflectInjectables(target: Type): ClassInjectable[] | InspectionFailure {
    const entries: ClassInjectable[] = [];
    const slots = parameters(target);
    if (slots) {
      for (let index = 0; index < Math.max(target.length, slots.length); index++) {
        const entry = inspectParameter(target, index, slots[index]);
        if ('kind' in entry) return entry;
        entries.push(entry);
      }
      return entries;
    }

    // Leave undecorated and delegated constructors to the framework's own resolver.
    let dependencies;
    try {
      dependencies = ReflectiveInjector.resolve([target])[0].resolvedFactories[0].dependencies;
    } catch (cause) {
      return {
        kind: 'failure',
        reason: 'invalid-metadata',
        target,
        location: { kind: 'class' },
        cause,
      };
    }
    for (const [index, dependency] of dependencies.entries()) {
      const entry = injectable(target, index, dependency.key.token);
      if ('kind' in entry) return entry;
      entries.push(entry);
    }
    return entries;
  }

  return { reflectInjectables };
}
