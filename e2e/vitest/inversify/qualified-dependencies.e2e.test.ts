import 'reflect-metadata';
import { expect, it } from 'vitest';
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
