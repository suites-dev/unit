import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import { SuitesError, UnitErrorCode } from '@suites/types.common';
import type { DependencyPathEntry } from './composition-boundary.js';
import { reportDependencyViolation } from '../dependency-verification-internal.js';
import { stringifyIdentifier } from './functions.static.js';

export type DependencyViolationCategory = 'undeclared dependency' | 'forbidden dependency';

export type GuardedDependency = (...args: unknown[]) => never;

const guardedDependencies = new WeakSet();

export function isGuardedDependency(value: unknown): boolean {
  return typeof value === 'function' && guardedDependencies.has(value);
}

export class DependencyRuleViolationError extends SuitesError {
  public constructor(
    public readonly category: DependencyViolationCategory,
    public readonly identifier: InjectableIdentifier,
    public readonly metadata: IdentifierMetadata | undefined,
    public readonly dependencyPath: readonly DependencyPathEntry[],
    public readonly operation: string
  ) {
    const dependency = stringifyIdentifier(identifier, metadata);
    const path = dependencyPath
      .map((entry) => stringifyIdentifier(entry.identifier, entry.metadata))
      .join(' -> ');
    const undeclared = category === 'undeclared dependency';
    super(
      undeclared
        ? UnitErrorCode.UNDECLARED_DEPENDENCY_ACCESS
        : UnitErrorCode.FORBIDDEN_DEPENDENCY_ACCESS,
      `Suites Unit rule violation: Cannot ${operation} ${category} ${dependency}. ` +
        `Dependency path: ${path}.`,
      undeclared
        ? 'Declare this dependency in the test setup to allow access.'
        : 'Remove the forbidden access or change the test boundary.'
    );
    this.name = 'DependencyRuleViolationError';
  }
}

export function createGuardedDependency(
  category: DependencyViolationCategory,
  identifier: InjectableIdentifier,
  metadata: IdentifierMetadata | undefined,
  dependencyPath: readonly DependencyPathEntry[]
): GuardedDependency {
  const fail = (operation: string): never =>
    reportDependencyViolation(
      new DependencyRuleViolationError(
        category,
        identifier,
        metadata,
        dependencyPath,
        operation
      )
    );
  const target = function guardedDependency(): never {
    return fail('call');
  };

  const guard = new Proxy(target, {
    get: (_target, key) => {
      if (key === Symbol.for('nodejs.util.inspect.custom')) {
        return () => `[Guarded ${category}: ${stringifyIdentifier(identifier, metadata)}]`;
      }
      return fail(`read ${String(key)} on`);
    },
    set: (_target, key) => fail(`write ${String(key)} on`),
    has: (_target, key) => fail(`check ${String(key)} on`),
    deleteProperty: (_target, key) => fail(`delete ${String(key)} on`),
    defineProperty: (_target, key) => fail(`define ${String(key)} on`),
    ownKeys: () => fail('enumerate'),
    getOwnPropertyDescriptor: (_target, key) => fail(`inspect ${String(key)} on`),
    getPrototypeOf: () => fail('inspect the prototype of'),
    setPrototypeOf: () => fail('change the prototype of'),
    apply: () => fail('call'),
    construct: () => fail('construct'),
  });
  guardedDependencies.add(guard);
  return guard;
}
