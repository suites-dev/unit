import { fn } from '@vitest/spy';
import { types } from 'node:util';
import type { DeepPartial } from '@suites/types.common';
import type { Mocked } from './types.js';

type MockTarget = Parameters<typeof Reflect.get>[0];

function fixtureTarget(source: MockTarget): MockTarget {
  if (Array.isArray(source) || types.isDate(source)) {
    const target = Array.isArray(source) ? [] : new Date(Date.prototype.getTime.call(source));
    Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(source));
    return target;
  }
  if (typeof source === 'function') {
    return new Proxy(Function.prototype.bind.call(source, undefined), {
      apply: (_bound, receiver, args) => Reflect.apply(source, receiver, args),
      construct: (_bound, args, constructor) => Reflect.construct(source, args, constructor),
    });
  }
  return Object.create(Reflect.getPrototypeOf(source));
}

/**
 * Creates a fully mocked instance with auto-generated Vitest stub methods.
 *
 * This function creates a type-safe mock where all methods are automatically replaced
 * with `vi.fn()` instances. Properties are lazily created on first access using
 * JavaScript Proxy, providing intelligent auto-mocking without manual setup.
 *
 * @template T The type of the object to mock
 * @param mockImplementation - Optional partial implementation to pre-configure specific methods or properties
 * @returns A fully mocked instance where all methods are `vi.fn()` stubs with full Vitest API support
 *
 * @remarks
 * - All methods automatically become Vitest mocks on first access
 * - Supports nested object mocking
 *
 * @example
 * ```ts
 * // Basic usage - mock an interface
 * import { mock } from '@suites/doubles.vitest';
 *
 * interface PaymentGateway {
 *   charge(amount: number): Promise<{ status: string }>;
 *   refund(transactionId: string): Promise<boolean>;
 * }
 *
 * const gateway = mock<PaymentGateway>();
 * gateway.charge.mockResolvedValue({ status: 'success' });
 * gateway.refund.mockResolvedValue(true);
 *
 * const userService = mock<UserService>();
 * userService.findUser.mockResolvedValue({ id: '1', name: 'John' });
 * ```
 *
 * @since 3.0.0
 * @see {@link https://vitest.dev/api/vi.html#vi-fn | Vitest Mock Functions}
 * @see {@link https://suites.dev/docs/api-reference/mock | Mock API Reference}
 */
export const mock = <T>(mockImplementation: DeepPartial<T> = {} as DeepPartial<T>): Mocked<T> => {
  const copies = new WeakMap<WeakKey, MockTarget>();

  function handler(source: MockTarget, mockAccessors: boolean): ProxyHandler<MockTarget> {
    return {
      get(target, key) {
        if (!Reflect.has(target, key)) {
          if (key === 'then' || key === 'calls' || key === Symbol.iterator) return undefined;
          const stub = fn();
          Reflect.set(stub, '_isMockObject', true);
          Reflect.set(target, key, new Proxy(stub, handler(stub, false)));
        }

        const value: unknown = Reflect.get(target, key, source);
        const own = Reflect.getOwnPropertyDescriptor(target, key);
        if (mockAccessors && own?.enumerable && own.get && own.set) {
          return copyValue(value);
        }
        return types.isDate(target) && typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value) {
        let owner: MockTarget | null = target;
        while (owner !== null) {
          const descriptor = Reflect.getOwnPropertyDescriptor(owner, key);
          if (descriptor !== undefined) {
            if (!('value' in descriptor)) return Reflect.set(target, key, value, source);
            if (!descriptor.writable && !descriptor.configurable)
              return Object.is(descriptor.value, value);
            break;
          }
          owner = Reflect.getPrototypeOf(owner);
        }
        return Reflect.set(target, key, value);
      },
    };
  }

  function copyValue(value: unknown): unknown {
    return value !== null && typeof value === 'object' ? copy(value) : value;
  }

  function copy(source: MockTarget): MockTarget {
    const known = copies.get(source);
    if (known !== undefined) return known;
    const target = fixtureTarget(source);
    const proxy = new Proxy(target, handler(source, true));
    copies.set(source, proxy);
    copies.set(proxy, proxy);
    for (const key of Reflect.ownKeys(source)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined) continue;
      if ('value' in descriptor) descriptor.value = copyValue(descriptor.value);
      Object.defineProperty(target, key, descriptor);
    }
    return proxy;
  }

  if (
    mockImplementation === null ||
    (typeof mockImplementation !== 'object' && typeof mockImplementation !== 'function')
  ) {
    throw new TypeError('A mock implementation must be an object or function.');
  }
  const proxy = copy(mockImplementation);
  if (!Reflect.has(proxy, '_isMockObject')) {
    Object.defineProperty(proxy, '_isMockObject', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    });
  }
  return proxy as Mocked<T>;
};
