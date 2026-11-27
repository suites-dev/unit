import { TestToken } from '../../__test__/test-token.js';
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
      [{ identifier: RealDependencyThree, metadata: undefined }, 'fake-value-1'],
      [{ identifier: RealDependencyFour, metadata: undefined }, 'another-fake-value-2'],
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
        dependency: 'two',
      })
    ).toEqual(DependencyTwoStubbed);

    expect(
      unitReference.get<DependencyTwoStubbed>(DependencyTwoSymbol, { dependency: 'two' })
    ).toEqual(DependencyTwoStubbed);
  });

  it('should throw an error indicating the dependency not found in case the identifier is missing', () => {
    expect(() => unitReference.get('does-not-exist')).toThrow(
      /Check that the token identifies a dependency/
    );
  });
});

describe('object token identity', () => {
  it('can label tokens with no discoverable constructor', () => {
    const reference = new UnitReference(new DependencyContainer([]), [], []);
    const token = new TestToken('payment');
    Object.defineProperty(token, '_desc', { value: 'payment' });
    Reflect.setPrototypeOf(token, null);
    expect(() => reference.get(token)).toThrow(/'payment'/);

    const prototype = Object.create(null, {
      constructor: {
        get: () => {
          throw new Error('constructor getter');
        },
      },
    });
    Reflect.setPrototypeOf(token, prototype);
    expect(() => reference.get(token)).toThrow(/'payment'/);
  });

  it('preserves the lookup error on invalid identifiers from JavaScript', () => {
    const reference = new UnitReference(new DependencyContainer([]), [], []);
    expect(() => Reflect.apply(reference.get, reference, [null])).toThrow(/ER040/);
    expect(() => Reflect.apply(reference.get, reference, [null, {}])).toThrow(
      /with metadata \[opaque\]/
    );
  });

  it('reports a missing token without invoking its conversion hook', () => {
    class HostileToken extends TestToken {
      toString(): string {
        throw new Error('token conversion');
      }
    }
    const reference = new UnitReference(new DependencyContainer([]), [], []);
    expect(() => reference.get(new HostileToken('payments'))).toThrow(/ER040/);
  });

  it('does not treat a different token with the same properties as finalized', () => {
    const finalized = new TestToken('repository');
    const mocked = new TestToken('repository');
    const mock = { find: jest.fn() };
    const reference = new UnitReference(
      new DependencyContainer([[{ identifier: mocked }, mock]]),
      [],
      [[{ identifier: finalized, metadata: undefined }, { find: () => 'final' }]]
    );
    expect(reference.get(mocked)).toBe(mock);
    expect(() => reference.get(finalized)).toThrow(/faked dependency/);
  });
});

describe('metadata-qualified final dependencies', () => {
  const metadata = { named: 'primary' };
  const identifiers: InjectableIdentifier[] = [
    'QUALIFIED',
    Symbol('QUALIFIED'),
    class Qualified {},
    new TestToken('QUALIFIED'),
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

    expect(() => reference.get('QUALIFIED')).toThrow(/without a qualifier/);
    expect(() => reference.get('QUALIFIED', { named: 'missing' })).toThrow(
      /No injection site matches/
    );
  });
});
