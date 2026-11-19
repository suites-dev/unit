/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { DeepPartial } from '@suites/types.common';
import type { VitestUtils } from 'vitest';
import type { Mocked } from './types.js';

declare const vi: VitestUtils;

type MockTarget = Record<PropertyKey, unknown>;

const overrideMockImp = <T>(obj: DeepPartial<T>): Mocked<T> => {
  const target = obj as MockTarget;
  const proxy = new Proxy(target, handler());

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
      proxy[name] = overrideMockImp(obj[name as never]);
    } else {
      proxy[name] = target[name];
    }
  }

  return proxy as Mocked<T>;
};

const handler = <T extends MockTarget | ReturnType<typeof vi.fn>>(): ProxyHandler<T> => ({
  set: (target, property, value: unknown) => {
    const obj = target as MockTarget;
    const descriptor = Object.getOwnPropertyDescriptor(obj, property);
    if (descriptor && 'value' in descriptor && !descriptor.writable && !descriptor.configurable) {
      return true;
    }
    obj[property] = value;
    return true;
  },

  get: (target, property) => {
    const obj = target as MockTarget;
    if (!(property in obj)) {
      if (property === 'then') {
        return undefined;
      }

      // Vitest's internal equality checking does some weird stuff to check for iterable equality
      if (property === Symbol.iterator) {
        return obj[property];
      }

      if (property !== 'calls') {
        obj[property] = new Proxy(vi.fn(), handler());
        // @ts-ignore private property
        obj[property as never]._isMockObject = true;
      }
    }

    if (obj instanceof Date && typeof obj[property] === 'function') {
      return obj[property].bind(obj);
    }

    return obj[property];
  },
});

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
  // @ts-ignore private property
  mockImplementation!._isMockObject = true;

  return overrideMockImp<T>(mockImplementation);
};
