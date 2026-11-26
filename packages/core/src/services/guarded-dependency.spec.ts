import {
  DependencyRuleViolationError,
  createGuardedDependency,
  type GuardedDependency,
} from './guarded-dependency.js';
import {
  DependencyViolationLedger,
  dependencyVerificationKey,
} from '../dependency-verification-internal.js';

import { TestToken } from '../../__test__/test-token.js';
import { DependencyContainer } from './dependency-container.js';
import { UnitReference } from './unit-reference.js';

class Checkout {}
class Inventory {}

beforeEach(() => {
  Reflect.defineProperty(global, dependencyVerificationKey, {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
});

describe('guarded dependencies', () => {
  it('permits injection until a business member is accessed', () => {
    const guard = createGuardedDependency('undeclared dependency', Inventory, undefined, [
      { identifier: Checkout, metadata: undefined },
      { identifier: Inventory, metadata: undefined },
    ]);

    expect(typeof guard).toBe('function');
    expect(() => Reflect.get(guard, 'available')).toThrow(
      expect.objectContaining({
        category: 'undeclared dependency',
        dependencyPath: [{ identifier: Checkout, metadata: undefined }, { identifier: Inventory, metadata: undefined }],
        identifier: Inventory,
        name: 'DependencyRuleViolationError',
        operation: 'read available on',
      })
    );
  });

  it('only retrieves intentional mocks when the same token also has a guarded qualifier', () => {
    const primary = { named: 'primary' };
    const replica = { named: 'replica' };
    const guard = createGuardedDependency('undeclared dependency', Inventory, primary, [
      { identifier: Inventory, metadata: primary },
    ]);
    const mock = { available: jest.fn() };
    const reference = new UnitReference(new DependencyContainer([
      [{ identifier: Inventory, metadata: primary }, guard],
      [{ identifier: Inventory, metadata: replica }, mock],
    ]), [], []);

    expect(() => reference.get(Inventory, primary)).toThrow(/Cannot retrieve guarded dependency/);
    expect(reference.get(Inventory, replica)).toBe(mock);
  });

  it.each<[string, (guard: GuardedDependency) => unknown]>([
    ['write stock on', (guard) => Reflect.set(guard, 'stock', 3)],
    ['check stock on', (guard) => Reflect.has(guard, 'stock')],
    ['delete stock on', (guard) => Reflect.deleteProperty(guard, 'stock')],
    ['define stock on', (guard) => Reflect.defineProperty(guard, 'stock', { value: 3 })],
    ['enumerate', (guard) => Reflect.ownKeys(guard)],
    ['inspect stock on', (guard) => Reflect.getOwnPropertyDescriptor(guard, 'stock')],
    ['inspect the prototype of', (guard) => Reflect.getPrototypeOf(guard)],
    ['change the prototype of', (guard) => Reflect.setPrototypeOf(guard, null)],
    ['construct', (guard) => Reflect.construct(guard, [])],
  ])('reports the attempted operation: %s', (operation, use) => {
    const guard = createGuardedDependency('undeclared dependency', Inventory, undefined, [
      { identifier: Checkout, metadata: undefined },
      { identifier: Inventory, metadata: undefined },
    ]);

    expect(() => use(guard)).toThrow(expect.objectContaining({ identifier: Inventory, operation }));
  });

  it('records access for file verification before throwing', () => {
    const ledger = new DependencyViolationLedger();
    Reflect.defineProperty(global, dependencyVerificationKey, {
      configurable: true,
      value: (error: Error) => ledger.record(error),
    });
    const guard = createGuardedDependency('forbidden dependency', Inventory, undefined, [
      { identifier: Checkout, metadata: undefined },
      { identifier: Inventory, metadata: undefined },
    ]);

    expect(() => Reflect.apply(guard, undefined, [])).toThrow(DependencyRuleViolationError);
    expect(ledger.finish()?.message).toMatch(/forbidden dependency 'Inventory'/i);
  });

  it('reports opaque identifiers and qualifiers without invoking their hooks', () => {
    const hook = jest.fn((): never => {
      throw new Error('Unexpected inspection');
    });
    const proxy = new Proxy(
      class {},
      {
        get: hook,
        getPrototypeOf: hook,
        ownKeys: hook,
        getOwnPropertyDescriptor: hook,
      }
    );
    const revoked = Proxy.revocable(class {}, {});
    revoked.revoke();
    class AccessorName {}
    Object.defineProperty(AccessorName, 'name', { get: hook });
    const qualifier = {
      get region() {
        return hook();
      },
      toJSON: hook,
      proxy,
    };
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const guard = createGuardedDependency(
      'forbidden dependency',
      AccessorName,
      qualifier,
      [
        { identifier: Checkout, metadata: undefined },
        { identifier: proxy, metadata: new Proxy({}, { ownKeys: hook, get: hook }) },
        { identifier: AccessorName, metadata: circular },
        { identifier: revoked.proxy, metadata: undefined },
        { identifier: Symbol('audit'), metadata: { named: 'primary' } },
      ]
    );

    const inspect = Reflect.get(guard, Symbol.for('nodejs.util.inspect.custom'));
    expect(inspect()).toContain('Guarded forbidden dependency');
    expect(() => guard()).toThrow(
      /Cannot call forbidden dependency.*Dependency path: 'Checkout'.*'Symbol\(audit\)'.*primary/
    );
    expect(hook).not.toHaveBeenCalled();
  });

  it('reports registered object tokens without invoking a description getter', () => {
    const token = new TestToken('payments');
    const lookup = jest.fn(() => {
      throw new Error('unexpected description read');
    });
    Object.defineProperty(token, '_desc', { get: lookup });
    const guard = createGuardedDependency('undeclared dependency', token, undefined, []);

    expect(() => guard()).toThrow(/undeclared dependency '\[object token\]'/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('retains a data-property token description and bounds wide qualifier output', () => {
    const token = new TestToken('payments');
    Object.defineProperty(token, '_desc', { value: 'PAYMENTS' });
    const qualifier = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index, index]));

    const guard = createGuardedDependency('forbidden dependency', token, qualifier, [
      { identifier: Checkout, metadata: { region: null } },
    ]);
    expect(() => guard()).toThrow(
      /forbidden dependency 'PAYMENTS', with metadata \[opaque\].*'Checkout', with metadata {"region":null}/
    );
  });

  it('includes qualified identifiers and the dependency path in diagnostics', () => {
    const metadata = { named: 'primary' } as never;
    const guard = createGuardedDependency('undeclared dependency', 'INVENTORY', metadata, [
      { identifier: Checkout, metadata: undefined },
      { identifier: 'INVENTORY', metadata },
    ]);

    expect(() => Reflect.get(guard, 'available')).toThrow(
      /Cannot read available on undeclared dependency 'INVENTORY', with metadata.*Dependency path: 'Checkout' -> 'INVENTORY'/i
    );
  });
});
