import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { TestBed } from '@suites/unit';
import { InversifyJSTestClass, SymbolToken } from './e2e-assets.js';

describe('Inversify DI Adapter Type Safety', () => {
  it('allows metadata argument for string tokens', async () => {
    const { unitRef } = await TestBed.solitary(InversifyJSTestClass)
      .mock<string>('BarToken', { named: 'someTarget' })
      .final('value')
      .compile();

    expect(unitRef).toBeDefined();
  });

  it('allows metadata argument for symbol tokens', async () => {
    const { unitRef } = await TestBed.solitary(InversifyJSTestClass)
      .mock<string>(SymbolToken, { inject: 'someIdentifier' })
      .final('value')
      .compile();

    expect(unitRef).toBeDefined();
  });

  it('works without metadata', async () => {
    const { unitRef } = await TestBed.solitary(InversifyJSTestClass)
      .mock<string>('CONSTANT_VALUE')
      .final('value')
      .compile();

    expect(unitRef).toBeDefined();
  });

  it('rejects non-object Inversify metadata at compile time', async () => {
    const builder = TestBed.solitary(InversifyJSTestClass);
    const { unitRef } = await builder.compile();

    // Type-check these invalid calls without executing them.
    const checkInvalidMetadata = () => {
      // @ts-expect-error Inversify identifier metadata must be an object.
      builder.mock('TOKEN', 'invalid metadata');
      // @ts-expect-error The DI reference also constrains augmented mock lookups.
      unitRef.get('TOKEN', 'invalid metadata');
    };
    expect(checkInvalidMetadata).toBeDefined();
  });
});
