import { TestBed } from '@suites/unit';
import { NestJSTestClass } from './e2e-assets.js';

describe('NestJS DI Adapter Type Safety', () => {
  it('allows mocking without metadata', async () => {
    const { unitRef } = await TestBed.solitary(NestJSTestClass)
      .mock<string>('CONSTANT_VALUE')
      .final('test-value')
      .compile();

    expect(unitRef).toBeDefined();
  });

  it('rejects identifier metadata for NestJS at compile time', async () => {
    const builder = TestBed.solitary(NestJSTestClass);
    const { unitRef } = await builder.compile();

    // Type-check these invalid calls without executing them.
    const checkInvalidMetadata = () => {
      // @ts-expect-error NestJS has no named or tagged identifier metadata.
      builder.mock('TOKEN', { named: 'value' });
      // @ts-expect-error The DI reference also constrains augmented mock lookups.
      unitRef.get('TOKEN', { named: 'value' });
    };
    expect(checkInvalidMetadata).toBeDefined();
  });
});
