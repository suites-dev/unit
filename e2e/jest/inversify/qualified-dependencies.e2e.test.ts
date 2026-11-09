import 'reflect-metadata';
import { expect, it } from '@jest/globals';
import { inject, injectable, named } from 'inversify';
import { TestBed } from '@suites/unit';

@injectable()
class Provider {
  label(): string {
    return 'real';
  }
}

@injectable()
class SingleConsumer {
  constructor(@inject(Provider) @named('primary') readonly provider: Provider) {}
}

it('rejects final retrieval through both qualified and unique bare-token lookups', async () => {
  const supplied = { label: () => 'final' };
  const { unit, unitRef } = await TestBed.solitary(SingleConsumer)
    .mock(Provider, { named: 'primary' })
    .final(supplied)
    .compile();

  expect(unit.provider).toBe(supplied);
  expect(unit.provider.label()).toBe('final');
  expect(() => unitRef.get(Provider, { named: 'primary' })).toThrow(/faked dependency/);
  expect(() => unitRef.get(Provider)).toThrow(/faked dependency/);
});

@injectable()
class DoubleConsumer {
  constructor(
    @inject(Provider) @named('primary') readonly primary: Provider,
    @inject(Provider) @named('secondary') readonly secondary: Provider
  ) {}
}

it('keeps named final and implementation overrides distinct for the same class', async () => {
  const supplied = { label: () => 'final' };
  const { unit, unitRef } = await TestBed.solitary(DoubleConsumer)
    .mock(Provider, { named: 'primary' })
    .final(supplied)
    .mock(Provider, { named: 'secondary' })
    .impl((stub) => ({ label: stub().mockReturnValue('mock') }))
    .compile();

  const mocked = unitRef.get(Provider, { named: 'secondary' });
  expect(unit.primary).toBe(supplied);
  expect(unit.secondary).toBe(mocked);
  expect(unit.primary.label()).toBe('final');
  expect(unit.secondary.label()).toBe('mock');
  expect(unit.primary).not.toBe(unit.secondary);
  mocked.label.mockReturnValue('updated');
  expect(unit.secondary.label()).toBe('updated');
  expect(unit.primary.label()).toBe('final');
  expect(() => unitRef.get(Provider, { named: 'primary' })).toThrow(/faked dependency/);
});

it('creates independent automatic mocks for differently named occurrences', async () => {
  const { unit, unitRef } = await TestBed.solitary(DoubleConsumer).compile();
  const primary = unitRef.get(Provider, { named: 'primary' });
  const secondary = unitRef.get(Provider, { named: 'secondary' });
  primary.label.mockReturnValue('primary');
  secondary.label.mockReturnValue('secondary');

  expect(primary).not.toBe(secondary);
  expect(unit.primary).toBe(primary);
  expect(unit.secondary).toBe(secondary);
  expect(unit.primary.label()).toBe('primary');
  expect(unit.secondary.label()).toBe('secondary');
  expect(() => unitRef.get(Provider)).toThrow(/could not be located/);
});

it('keeps automatic mock selectors bound to their named dependency', async () => {
  const builder = TestBed.sociable(DoubleConsumer).compose();
  const primary = builder.mock(Provider, { named: 'primary' });
  const secondary = builder.mock(Provider, { named: 'secondary' });
  secondary.final({ label: () => 'supplied' });
  primary.auto();
  const { unit, unitRef } = await builder.compile();
  const mocked = unitRef.get(Provider, { named: 'primary' });
  mocked.label.mockReturnValue('automatic');
  expect(unit.primary).toBe(mocked);
  expect(unit.primary.label()).toBe('automatic');
  expect(unit.secondary.label()).toBe('supplied');
  expect(unit.primary).not.toBe(unit.secondary);
  expect(() => unitRef.get(Provider, { named: 'secondary' })).toThrow(/faked dependency/);
});
