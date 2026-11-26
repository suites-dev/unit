import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import type { DependencyPathEntry } from './composition-boundary.js';
import { reportDependencyViolation } from '../dependency-verification-internal.js';
import { types } from 'node:util';

export type DependencyViolationCategory = 'undeclared dependency' | 'forbidden dependency';

export type GuardedDependency = (...args: unknown[]) => never;

const guardedDependencies = new WeakSet();

// Coercing a user token can run application code before the runner records the violation.
function tokenName(identifier: InjectableIdentifier): string {
  if (typeof identifier === 'string' || typeof identifier === 'symbol') return String(identifier);
  if (types.isProxy(identifier)) return '[opaque token]';
  if (typeof identifier === 'function') {
    const name = Object.getOwnPropertyDescriptor(identifier, 'name')?.value;
    return typeof name === 'string' ? name : '[function]';
  }
  // InjectionJS stores its human-readable token description as an own data property.
  const description = Object.getOwnPropertyDescriptor(identifier, '_desc')?.value;
  return typeof description === 'string' ? description : '[object token]';
}

function formatMetadata(metadata: IdentifierMetadata): string {
  if (types.isProxy(metadata)) return '[opaque]';
  const fields = Object.keys(metadata);
  if (fields.length > 8) return '[opaque]';
  return `{${fields
    .map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
      const value: unknown = descriptor?.value;
      const scalar = value === null || ['string', 'number', 'boolean'].includes(typeof value);
      return `${JSON.stringify(key)}:${scalar ? JSON.stringify(value) : '[opaque]'}`;
    })
    .join(',')}}`;
}

export function formatGuardedIdentifier(
  identifier: InjectableIdentifier,
  metadata: IdentifierMetadata | undefined
): string {
  try {
    const name = tokenName(identifier);
    return metadata === undefined
      ? `'${name}'`
      : `'${name}', with metadata ${formatMetadata(metadata)}`;
  } catch {
    // Reflection on an exotic object (such as an uninitialized module namespace) may throw.
    return metadata === undefined ? "'[opaque token]'" : "'[opaque token]', with metadata [opaque]";
  }
}

export function isGuardedDependency(value: unknown): boolean {
  return typeof value === 'function' && guardedDependencies.has(value);
}

export class DependencyRuleViolationError extends Error {
  public constructor(
    public readonly category: DependencyViolationCategory,
    public readonly identifier: InjectableIdentifier,
    public readonly metadata: IdentifierMetadata | undefined,
    public readonly dependencyPath: readonly DependencyPathEntry[],
    public readonly operation: string
  ) {
    const dependency = formatGuardedIdentifier(identifier, metadata);
    const path = dependencyPath
      .map((entry) => formatGuardedIdentifier(entry.identifier, entry.metadata))
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

  const guard = new Proxy(target, {
    get: (_target, key) => {
      if (key === Symbol.for('nodejs.util.inspect.custom')) {
        return () => `[Guarded ${category}: ${formatGuardedIdentifier(identifier, metadata)}]`;
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
