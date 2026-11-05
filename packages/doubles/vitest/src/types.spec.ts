import { expect, expectTypeOf, it, vi } from 'vitest';
import type { Stub } from './types.js';

it('preserves explicit stub arguments and return values', () => {
  const stub: Stub<[name: string, count: number], boolean> =
    vi.fn<(name: string, count: number) => boolean>();

  expectTypeOf(stub).parameters.toEqualTypeOf<[string, number]>();
  expectTypeOf(stub).returns.toEqualTypeOf<boolean>();
  expectTypeOf(stub.mockReturnValue).parameter(0).toEqualTypeOf<boolean>();

  stub.mockReturnValue(true);
  expect(stub('example', 2)).toBe(true);
  expect(stub).toHaveBeenCalledWith('example', 2);
});

it('preserves the resolved value type of async stubs', async () => {
  const stub: Stub<[id: string], Promise<number>> = vi.fn<(id: string) => Promise<number>>();

  expectTypeOf(stub.mockResolvedValue).parameter(0).toEqualTypeOf<number>();
  stub.mockResolvedValue(42);

  await expect(stub('example')).resolves.toBe(42);
});
