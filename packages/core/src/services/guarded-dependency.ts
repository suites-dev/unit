import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import { reportDependencyViolation } from '../dependency-verification.js';
import { stringifyIdentifier } from './functions.static.js';

export type DependencyViolationCategory = 'undeclared dependency' | 'forbidden dependency';

export interface DependencyPathEntry {
  identifier: InjectableIdentifier;
  metadata?: IdentifierMetadata;
}

export type GuardedDependency = (...args: unknown[]) => never;

export class DependencyRuleViolationError extends Error {
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
    super(
      `Suites Unit rule violation: Cannot ${operation} ${category} ${dependency}. ` +
        `Dependency path: ${path}.`
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

  return new Proxy(target, {
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
}
