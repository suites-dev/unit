import type { InjectableIdentifier } from '@suites/types.di';
import type { ConstantValue } from '@suites/types.common';
import type { StubbedInstance } from '@suites/types.doubles';
import { UnitReference } from './unit-reference.js';
import { DependencyContainer, type IdentifierToFinal } from './dependency-container.js';

class DependencyOne {}
class DependencyOneStubbed {}
class DependencyTwoStubbed {}
class RealDependencyOne {}
class RealDependencyTwo {}
class RealDependencyThree {}
class RealDependencyFour {}

const DependencyOneSymbol = Symbol('DependencyOneSymbol');
const DependencyTwoSymbol = Symbol('DependencyTwoSymbol');
const ConstantValueSymbol = Symbol('ConstantValueSymbol');

describe('Unit Reference Unit Spec', () => {
  let unitReference: UnitReference;

  beforeAll(() => {
    const mocksContainer = new DependencyContainer([
      // Types
      [{ identifier: DependencyOne }, DependencyOneStubbed],
      [{ identifier: 'DEPENDENCY_ONE' }, DependencyOneStubbed],
      [{ identifier: DependencyOneSymbol }, DependencyOneStubbed],
      // Constants
      [{ identifier: 'CONSTANT_VALUE' }, ['1', '2', '3']],
      [{ identifier: ConstantValueSymbol }, [1, 2, 3]],
      // With Metadata
      [{ identifier: 'DEPENDENCY_TWO', metadata: { dependency: 'two' } }, DependencyTwoStubbed],
      [{ identifier: DependencyTwoSymbol, metadata: { dependency: 'two' } }, DependencyTwoStubbed],
    ]);

    const fakedDependencies: IdentifierToFinal[] = [
      [{ identifier: RealDependencyThree }, 'fake-value-1'],
      [{ identifier: RealDependencyFour }, 'another-fake-value-2'],
    ];

    unitReference = new UnitReference(
      mocksContainer,
      [RealDependencyOne, RealDependencyTwo],
      fakedDependencies
    );
  });

  it('should throw an error indicating the dependency cannot be retrieved because it is faked', () => {
    expect(() => unitReference.get(RealDependencyThree)).toThrow(
      /as it is marked as a faked dependency/
    );
    expect(() => unitReference.get(RealDependencyFour)).toThrow(
      /as it is marked as a faked dependency/
    );
  });

  it('should throw an error indicating the dependency cannot be retrieved because it is exposed', () => {
    expect(() => unitReference.get(RealDependencyOne)).toThrow(
      /as it is marked as an exposed dependency/
    );
  });

  it.each([
    [DependencyOne, DependencyOneStubbed],
    ['DEPENDENCY_ONE', DependencyOneStubbed],
    [DependencyOneSymbol, DependencyOneStubbed],
    ['CONSTANT_VALUE', ['1', '2', '3']],
    [ConstantValueSymbol, [1, 2, 3]],
  ])(
    'should return the corresponding class or value impl unique identifier with no metadata',
    (identifier: InjectableIdentifier, value: StubbedInstance<unknown> | ConstantValue) => {
      expect(unitReference.get(identifier)).toEqual(value);
    }
  );

  it('should return the corresponding class or value impl unique identifier with metadata combined', () => {
    expect(
      unitReference.get<DependencyTwoStubbed>('DEPENDENCY_TWO', {
        dependency: 'two' as never,
      })
    ).toEqual(DependencyTwoStubbed);

    expect(
      unitReference.get<DependencyTwoStubbed>(DependencyTwoSymbol, { dependency: 'two' } as never)
    ).toEqual(DependencyTwoStubbed);
  });

  it('should throw an error indicating the dependency not found in case the identifier is missing', () => {
    expect(() => unitReference.get('does-not-exist')).toThrow(
      /is correctly mocked or explicitly exposed in the/
    );
  });
});

describe('object token identity', () => {
  it('does not treat a different token with the same properties as finalized', () => {
    const finalized = { description: 'repository' } as unknown as InjectableIdentifier;
    const mocked = { description: 'repository' } as unknown as InjectableIdentifier;
    const mock = { find: jest.fn() };
    const reference = new UnitReference(
      new DependencyContainer([[{ identifier: mocked }, mock]]),
      [],
      [[{ identifier: finalized }, { find: () => 'final' }]]
    );
    expect(reference.get(mocked)).toBe(mock);
    expect(() => reference.get(finalized)).toThrow(/faked dependency/);
  });
});

describe('metadata-qualified final dependencies', () => {
  const metadata = { named: 'primary' } as never;
  const identifiers: InjectableIdentifier[] = [
    'QUALIFIED',
    Symbol('QUALIFIED'),
    class Qualified {},
    { description: 'QUALIFIED' } as unknown as InjectableIdentifier,
  ];

  it.each(identifiers)('rejects a final selected by bare-token fallback (%s)', (identifier) => {
    const value = { endpoint: 'fixed' };
    const key = { identifier, metadata };
    const reference = new UnitReference(
      new DependencyContainer([[key, value]]),
      [],
      [[key, value]]
    );

    expect(() => reference.get(identifier)).toThrow(/faked dependency/);
    expect(() => reference.get(identifier, metadata)).toThrow(/faked dependency/);
  });

  it.each([false, 0, null, undefined])(
    'rejects a final value of %s before value lookup',
    (value) => {
      const key = { identifier: 'QUALIFIED', metadata };
      const reference = new UnitReference(
        new DependencyContainer([[key, value as never]]),
        [],
        [[key, value as never]]
      );

      expect(() => reference.get('QUALIFIED')).toThrow(/faked dependency/);
    }
  );

  it('preserves bare-token fallback for a unique qualified mock', () => {
    const mock = { find: jest.fn() };
    const reference = new UnitReference(
      new DependencyContainer([[{ identifier: 'QUALIFIED', metadata }, mock]]),
      [],
      []
    );

    expect(reference.get('QUALIFIED')).toBe(mock);
  });

  it('does not block an unqualified mock sharing a token and value with a qualified final', () => {
    const sharedValue = { find: jest.fn() };
    const finalKey = { identifier: 'QUALIFIED', metadata };
    const reference = new UnitReference(
      new DependencyContainer([
        [finalKey, sharedValue],
        [{ identifier: 'QUALIFIED' }, sharedValue],
      ]),
      [],
      [[finalKey, sharedValue]]
    );

    expect(reference.get('QUALIFIED')).toBe(sharedValue);
    expect(() => reference.get('QUALIFIED', metadata)).toThrow(/faked dependency/);
  });

  it('preserves ambiguity and mismatched-metadata failures', () => {
    const finalKey = { identifier: 'QUALIFIED', metadata };
    const reference = new UnitReference(
      new DependencyContainer([
        [finalKey, { endpoint: 'fixed' }],
        [{ identifier: 'QUALIFIED', metadata: { named: 'secondary' } }, { find: jest.fn() }],
      ]),
      [],
      [[finalKey, { endpoint: 'fixed' }]]
    );

    expect(() => reference.get('QUALIFIED')).toThrow(/could not be located/);
    expect(() => reference.get('QUALIFIED', { named: 'missing' } as never)).toThrow(
      /could not be located/
    );
  });
});
