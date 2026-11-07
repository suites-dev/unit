/// <reference types="vitest" />
import type { DeepPartial } from '@suites/types.common';
import type { DoublesAdapter, StubbedInstance } from '@suites/types.doubles';
import { mock } from './mock.static.js';
import type { Mocked } from './types.js';
export { Mocked, Stub } from './types.js';
import type { Mock } from '@vitest/spy';
import { fn } from '@vitest/spy';

function adapterMock<T>(implementation?: DeepPartial<T>): Mocked<T>;
function adapterMock(implementation?: DeepPartial<unknown>): StubbedInstance<unknown>;
function adapterMock(implementation: DeepPartial<unknown> = {}): StubbedInstance<unknown> {
  return mock<DeepPartial<unknown>>(implementation);
}

/**
 * Adapter for a Vitest mocking library to be used with Suites framework.
 *
 * @see {@link https://suites.dev/docs/api-reference/mock | Mock API Reference}
 * @since 3.0.0
 * @example
 * ```ts
 * import { adapter } from '@suites/doubles.vitest';
 *
 * const mockedService = adapter.mock<MyService>();
 * ```
 */
export const adapter = { mock: adapterMock, stub: (): Mock => fn() } satisfies DoublesAdapter;

export { mock } from './mock.static.js';

/**
 * Creates a standalone Vitest mock function for stubbing callbacks and functions.
 *
 * This function creates a `vi.fn()` instance that can be configured with return values,
 * implementations, and used to assert call patterns. It's ideal for stubbing callbacks,
 * event handlers, or any standalone function that needs to be mocked.
 *
 * @returns A Vitest mock function with full Vitest mocking API support
 *
 * @remarks
 * - Returns a `vi.fn()` when `@suites/doubles.vitest` is installed
 * - Automatically tracks all calls, arguments, and return values
 * - Supports all Vitest mock methods (mockReturnValue, mockResolvedValue, etc.)
 * - Use for standalone functions, callbacks, and event handlers
 * - For mocking entire objects, use `mock<T>()` instead
 *
 * @example
 * ```ts
 * // Basic usage - create a simple stub
 * import { stub } from '@suites/unit';
 *
 * const callback = stub();
 * callback.mockReturnValue(42);
 *
 * const result = callback(); // returns 42
 * expect(callback).toHaveBeenCalledTimes(1);
 * ```
 *
 * @since 3.0.0
 * @see {@link https://vitest.dev/api/vi.html#vi-fn | Vitest Mock Functions}
 * @see {@link https://suites.dev/docs/api-reference/mock | Stub API Reference}
 * @see {@link mock} for mocking entire objects
 */
export const stub = fn;
