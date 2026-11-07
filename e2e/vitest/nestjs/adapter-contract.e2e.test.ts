import { adapter, type Mocked } from '@suites/doubles.vitest';
import type { DoublesAdapter, MockFunction } from '@suites/types.doubles';
import { describe, expect, expectTypeOf, it } from 'vitest';

const doublesAdapter: DoublesAdapter = adapter;
const createMock: MockFunction = adapter.mock;

interface Repository {
  find(id: string): Promise<string>;
  nested: { count(): number };
  identity<T>(value: T): T;
  convert(value: number): number;
  convert(value: string): string;
}

describe('Vitest doubles adapter contract', () => {
  it('creates mocks and callable stubs through the shared interface', () => {
    expect(createMock()).toBeDefined();
    const stub = doublesAdapter.stub();
    const dependency = doublesAdapter.mock({ find: stub });

    expect(dependency).toHaveProperty('find', stub);
    expect(stub('id')).toBeUndefined();
    expect(stub).toHaveBeenCalledWith('id');
  });

  it('preserves generic mock signatures and nested method types', async () => {
    const repository = adapter.mock<Repository>();
    expectTypeOf(repository).toEqualTypeOf<Mocked<Repository>>();
    expectTypeOf(repository.identity(42)).toEqualTypeOf<number>();
    expectTypeOf(repository.convert(42)).toEqualTypeOf<number>();
    expectTypeOf(repository.convert('value')).toEqualTypeOf<string>();

    repository.find.mockResolvedValue('value');
    repository.nested.count.mockReturnValue(42);
    await expect(repository.find('id')).resolves.toBe('value');
    expect(repository.nested.count()).toBe(42);

    const invalidCalls = () => {
      // @ts-expect-error Explicit generic arguments retain method parameter types.
      repository.find(42);
      // @ts-expect-error Explicit generic arguments retain resolved value types.
      repository.find.mockResolvedValue(42);
    };
    expect(invalidCalls).toBeTypeOf('function');
  });

  it('accepts partial implementations with an explicit dependency type', async () => {
    const repository = adapter.mock<Repository>({ find: async (id: string) => id });
    await expect(repository.find('id')).resolves.toBe('id');
  });
});
