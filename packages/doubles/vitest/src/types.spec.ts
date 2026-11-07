import { expect, expectTypeOf, it, vi } from 'vitest';
import type { Mocked, Stub } from './types.js';
import { mock } from './mock.static.js';

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

it('preserves nested mock methods and their argument and return types', async () => {
  interface Repository {
    find(id: string): Promise<{ id: string }>;
    settings: { readonly enabled: boolean; retries(): number };
  }

  const repository: Mocked<Repository> = mock<Repository>();
  repository.find.mockResolvedValue({ id: 'user-1' });
  repository.settings.retries.mockReturnValue(3);

  expectTypeOf(repository.find).parameter(0).toEqualTypeOf<string>();
  expectTypeOf(repository.find).returns.toEqualTypeOf<Promise<{ id: string }>>();
  await expect(repository.find('user-1')).resolves.toEqual({ id: 'user-1' });
  expect(repository.settings.retries()).toBe(3);

  const invalidCalls = () => {
    // @ts-expect-error Method arguments retain their original types.
    repository.find(1);
    // @ts-expect-error Resolved values retain their original shape.
    repository.find.mockResolvedValue({ id: 1 });
    // @ts-expect-error Nested methods retain their return types.
    repository.settings.retries.mockReturnValue('three');
    // @ts-expect-error Readonly properties remain readonly.
    repository.settings.enabled = true;
    // @ts-expect-error Promise properties belong to the return value, not the method.
    void repository.find.then;
  };
  expect(invalidCalls).toBeTypeOf('function');
});

it('preserves generic and overloaded method call signatures', () => {
  interface Service {
    identity<T>(value: T): T;
    convert(value: number): number;
    convert(value: string): string;
  }

  const service = mock<Service>();
  expectTypeOf(service.identity('example')).toEqualTypeOf<string>();
  expectTypeOf(service.identity({ id: 'example' })).toEqualTypeOf<{ id: string }>();
  expectTypeOf(service.convert(1)).toEqualTypeOf<number>();
  expectTypeOf(service.convert('one')).toEqualTypeOf<string>();

  service.convert.mockReturnValue('converted');
  expect(service.convert('one')).toBe('converted');
});
