import { jest as jestGlobals } from '@jest/globals';
import { mock } from './mock.static.js';
import type { Stub } from './types.js';
export { Mocked, Stub } from './types.js';
/**
 * Adapter for a Jest mocking library to be used with Suites framework.
 *
 * @see {@link https://suites.dev/docs/api-reference/mock | Mock API Reference}
 * @since 3.0.0
 * @example
 * ```ts
 * import { adapter } from '@suites/doubles.jest';
 *
 * const mockedService = adapter.mock<MyService>();
 * ```
 */
export const adapter = { mock, stub: (): Stub<any> => jestGlobals.fn() as Stub<any> };

export { mock } from './mock.static.js';

export { stub } from './stub.js';
