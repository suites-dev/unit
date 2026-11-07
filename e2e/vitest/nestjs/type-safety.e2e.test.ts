import { describe, it, expect } from 'vitest';
import { TestBed, type Mocked } from '@suites/unit';
import { Injectable } from '@nestjs/common';
import { NestJSTestClass } from './e2e-assets';

describe('NestJS DI Adapter Type Safety', () => {
  it('allows mocking without metadata', async () => {
    const { unitRef } = await TestBed.solitary(NestJSTestClass)
      .mock<string>('CONSTANT_VALUE')
      .final('test-value')
      .compile();

    expect(unitRef).toBeDefined();
  });
});

@Injectable()
class Repository {
  async find(id: string): Promise<string> {
    return id;
  }
}

@Injectable()
class Service {
  constructor(readonly repository: Repository) {}
}

it('preserves mock types inferred from constructor tokens', async () => {
  const { unitRef } = await TestBed.solitary(Service).compile();
  const repository = unitRef.get(Repository);
  repository.find.mockResolvedValue('result');
  const typed: Mocked<Repository> = repository;
  typed.find.mockReturnValue(Promise.resolve('value'));
  await expect(repository.find('id')).resolves.toBe('value');

  const invalidCalls = () => {
    // @ts-expect-error Mock return values must remain typed.
    repository.find.mockResolvedValue(123);
    // @ts-expect-error Constructor token inference must retain arguments.
    repository.find(123);
    // @ts-expect-error Promise members belong to the returned value.
    void repository.find.then;
  };
  expect(invalidCalls).toBeDefined();

  const { unit } = await TestBed.solitary(Service)
    .mock(Repository)
    .impl((stub) => ({ find: stub().mockResolvedValue('fake') }))
    .compile();
  await expect(unit.repository.find('id')).resolves.toBe('fake');
});
