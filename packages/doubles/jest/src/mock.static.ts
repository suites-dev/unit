import { jest as jestGlobals } from '@jest/globals';
/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { DeepPartial } from '@suites/types.common';
import type { Mocked } from './types.js';

type ProxiedProperty = string | number | symbol;

const overrideMockImp = <T>(obj: DeepPartial<T>): Mocked<T> => {
  const proxy = new Proxy<Mocked<T>>(obj as Mocked<T>, handler(true));

  for (const name of Object.keys(obj)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, name);
    // Accessors already live on the proxy target; preserve them without evaluating or assigning.
    if (descriptor && ('get' in descriptor || 'set' in descriptor)) {
      continue;
    }

    if (descriptor && !descriptor.writable && !descriptor.configurable) {
      continue;
    }

    if (typeof obj[name as never] === 'object' && obj[name as never] !== null) {
      // @ts-ignore
      proxy[name] = overrideMockImp(obj[name as never]);
    } else {
      // @ts-ignore
      proxy[name] = obj[name];
    }
  }

  return proxy;
};

const handler = <T>(deepMockAccessors = false) => {
  const accessorMocks = new WeakMap<WeakKey, unknown>();

  return {
    set: (obj: Mocked<T>, property: ProxiedProperty, value: T) => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, property);
      if (descriptor && 'value' in descriptor && !descriptor.writable && !descriptor.configurable) {
        return true;
      }
      // @ts-ignore https://github.com/microsoft/TypeScript/issues/1863
      obj[property] = value;
      return true;
    },

    get: (obj: Mocked<T>, property: ProxiedProperty) => {
      // @ts-ignore
      if (!(property in obj)) {
        if (property === 'then') {
          return undefined;
        }

        // Jest's internal equality checking does some weird stuff to check for iterable equality
        if (property === Symbol.iterator) {
          // @ts-ignore
          return obj[property];
        }

        if (property !== 'calls') {
          // @ts-ignore
          obj[property] = new Proxy<jest.Mock<T>>(jestGlobals.fn(), handler());
          // @ts-ignore private property
          obj[property as never]._isMockObject = true;
        }
      }

      const value: unknown = Reflect.get(obj, property);
      const descriptor = Object.getOwnPropertyDescriptor(obj, property);
      if (
        deepMockAccessors &&
        descriptor?.enumerable &&
        descriptor.get &&
        descriptor.set &&
        typeof value === 'object' &&
        value !== null
      ) {
        const cached = accessorMocks.get(value);
        if (cached) {
          return cached;
        }
        const mocked = overrideMockImp(value);
        accessorMocks.set(value, mocked);
        accessorMocks.set(mocked, mocked);
        return mocked;
      }

      if (obj instanceof Date && typeof value === 'function') {
        return value.bind(obj);
      }

      return value;
    },
  };
};

/**
 * Creates a fully mocked instance with auto-generated Jest stub methods.
 *
 * This function creates a type-safe mock where all methods are automatically replaced
 * with `jest.fn()` instances. Properties are lazily created on first access using
 * JavaScript Proxy, providing intelligent auto-mocking without manual setup.
 *
 * @template T The type of the object to mock
 * @param mockImplementation - Optional partial implementation to pre-configure specific methods or properties
 * @returns A fully mocked instance where all methods are `jest.fn()` stubs with full Jest API support
 *
 * @remarks
 * - All methods automatically become Jest mocks on first access
 * - Supports nested object mocking
 *
 * @example
 * ```ts
 * // Basic usage - mock an interface
 * import { mock } from '@suites/unit';
 *
 * interface PaymentGateway {
 *   charge(amount: number): Promise<{ status: string }>;
 *   refund(transactionId: string): Promise<boolean>;
 * }
 *
 * const gateway = mock<PaymentGateway>();
 * gateway.charge.mockResolvedValue({ status: 'success' });
 * gateway.refund.mockResolvedValue(true);
 * ```
 *
 * @since 3.0.0
 * @see {@link https://jestjs.io/docs/mock-function-api | Jest Mock Functions}
 * @see {@link https://suites.dev/docs/api-reference/mock | Mock API Reference}
 */
export const mock = <T>(mockImplementation: DeepPartial<T> = {} as DeepPartial<T>): Mocked<T> => {
  // @ts-ignore private property
  mockImplementation!._isMockObject = true;

  return overrideMockImp<T>(mockImplementation);
};
