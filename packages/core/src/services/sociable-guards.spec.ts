import type { Type } from '@suites/types.common';
import type { ClassInjectable, DependencyInjectionAdapter } from '@suites/types.di';
import { dependencyVerificationKey } from '../dependency-verification-internal.js';
import { DependencyContainer } from './dependency-container.js';
import { UnitMocker } from './unit-mocker.js';

class Inventory {
  public available(): boolean {
    return true;
  }
}

class Checkout {
  public constructor(private readonly inventory: Inventory) {}

  public available(): boolean {
    return this.inventory.available();
  }
}

function adapterFor(target: Type, dependencies: ClassInjectable[]): DependencyInjectionAdapter {
  return {
    inspect: (type) => ({
      list: () => (type === target ? dependencies : []),
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
}

beforeEach(() => {
  Reflect.defineProperty(global, dependencyVerificationKey, {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
});

describe('sociable dependency guards', () => {
  const adapter = adapterFor(Checkout, [
    { identifier: Inventory, type: 'PARAM' } as ClassInjectable,
  ]);

  it('injects an unused undeclared dependency without failing construction', async () => {
    const mocker = new UnitMocker(Promise.resolve(jest.fn), Promise.resolve(adapter));

    const result = await mocker.constructUnit(
      Checkout,
      [],
      new DependencyContainer([]),
      { mode: 'selective', bindings: new Map() }
    );

    expect(result.instance).toBeInstanceOf(Checkout);
  });

  it('throws a path-aware violation when an undeclared dependency is used', async () => {
    const mocker = new UnitMocker(Promise.resolve(jest.fn), Promise.resolve(adapter));
    const { instance } = await mocker.constructUnit(
      Checkout,
      [],
      new DependencyContainer([]),
      { mode: 'selective', bindings: new Map() }
    );

    expect(() => instance.available()).toThrow(
      /Cannot read available on undeclared dependency 'Inventory'.*Dependency path: 'Checkout' -> 'Inventory'/i
    );
  });

  it('retains intentional configured mocks', async () => {
    const inventory = { available: jest.fn(() => false) };
    const mocker = new UnitMocker(Promise.resolve(jest.fn), Promise.resolve(adapter));
    const { instance } = await mocker.constructUnit(
      Checkout,
      [],
      new DependencyContainer([[{ identifier: Inventory }, inventory]]),
      { mode: 'selective', bindings: new Map() }
    );

    expect(instance.available()).toBe(false);
    expect(inventory.available).toHaveBeenCalledTimes(1);
  });

  it('constructs explicitly exposed dependencies as real instances', async () => {
    const mocker = new UnitMocker(Promise.resolve(jest.fn), Promise.resolve(adapter));
    const { instance } = await mocker.constructUnit(
      Checkout,
      [Inventory],
      new DependencyContainer([]),
      { mode: 'selective', bindings: new Map() }
    );

    expect(instance.available()).toBe(true);
  });
});
