/* eslint-disable @typescript-eslint/no-unused-vars */
import { vi } from 'vitest';
import { mock } from './mock.static.js';
import type { Mocked } from './types.js';

interface ArbitraryMock {
  id: number;
  someValue?: boolean | null;
  getNumber: () => number;
  getNumberWithMockArg: (mock: never) => number;
  getSomethingWithArgs: (arg1: number, arg2: number) => number;
  getSomethingWithMoreArgs: (arg1: number, arg2: number, arg3: number) => number;
}

interface User {
  id: string;
  name: string;
  age: number;
}

class Prisma {
  public user: {
    create: (data: User) => Promise<User>;
    delete: (where: { id: string }) => Promise<User>;
  };
}

class TestClass implements ArbitraryMock {
  readonly id: number;

  constructor(id: number) {
    this.id = id;
  }

  public ofAnother(test: TestClass) {
    return test.getNumber();
  }

  public getNumber() {
    return this.id;
  }

  public getNumberWithMockArg(mock: never) {
    return this.id;
  }

  public getSomethingWithArgs(arg1: number, arg2: number) {
    return this.id;
  }

  public getSomethingWithMoreArgs(arg1: number, arg2: number, arg3: number) {
    return this.id;
  }
}

describe('Mocking Proxy Mechanism Unit Spec', () => {
  describe('fixture ownership', () => {
    test('isolates data writes and lazy stubs while retaining aliases and cycles', () => {
      interface FixtureNode {
        count: number;
        next: FixtureNode | null;
      }
      interface Node extends FixtureNode {
        visit(): void;
      }
      const node: FixtureNode = { count: 1, next: null };
      node.next = node;
      const source = { first: node, entries: [node] };
      const first = mock<{ first: Node; entries: Node[] }>(source);
      const second = mock<{ first: Node; entries: Node[] }>(source);

      expect(first.first.next).toBe(first.first);
      expect(first.entries[0]).toBe(first.first);
      first.first.count = 2;
      first.first.visit();
      expect(first.entries[0].count).toBe(2);
      expect(first.entries[0].visit).toHaveBeenCalledTimes(1);
      expect(second.first.visit).not.toHaveBeenCalled();
      expect(node.count).toBe(1);
      expect(node).not.toHaveProperty('visit');
      first.entries.pop();
      expect(source.entries).toHaveLength(1);
    });

    test('forwards calls to a supplied function with its caller and arguments', () => {
      function label(this: { name: string }, suffix: string) {
        return this.name + suffix;
      }
      const wrapped = mock(label);
      if (typeof wrapped !== 'function') throw new Error('Expected a callable mock');

      expect(Reflect.apply(wrapped, { name: 'checkout' }, ['-ready'])).toBe('checkout-ready');
      expect(label).not.toHaveProperty('_isMockObject');
    });

    test('forwards construction with the supplied arguments and new target', () => {
      class Receipt {
        readonly constructorUsed = new.target;
        constructor(readonly id: number) {}
      }
      const wrapped = mock(Receipt);
      if (typeof wrapped !== 'function') throw new Error('Expected a constructable mock');

      const receipt = Reflect.construct(wrapped, [5]);
      expect(receipt).toBeInstanceOf(Receipt);
      expect(receipt).toBeInstanceOf(wrapped);
      expect(Reflect.get(wrapped, 'prototype')).toBe(Receipt.prototype);
      expect(receipt).toHaveProperty('id', 5);
      expect(receipt.constructorUsed).toBe(wrapped);
    });

    test('uses the original receiver for a private-field accessor and isolates native dates', () => {
      class Settings {
        #name = 'before';
        get name() {
          return this.#name;
        }
        set name(next: string) {
          this.#name = next;
        }
      }
      const settings = new Settings();
      const source = { settings, created: new Date('2020-05-04T00:00:00Z') };
      const wrapped = mock(source);

      wrapped.settings.name = 'after';
      expect(settings.name).toBe('after');
      expect(wrapped.settings.name).toBe('after');
      wrapped.created.setUTCFullYear(2024);
      expect(source.created.getUTCFullYear()).toBe(2020);
      expect(wrapped.created.getUTCFullYear()).toBe(2024);
    });

    test('preserves locked data descriptors and leaves reserved lazy lookups absent', () => {
      const source = Object.freeze({ name: 'fixed' });
      const wrapped = mock(source);

      expect(Reflect.set(wrapped, 'name', 'fixed')).toBe(true);
      expect(Reflect.set(wrapped, 'name', 'changed')).toBe(false);
      for (const key of ['then', 'calls', Symbol.iterator]) {
        expect(Reflect.get(wrapped, key)).toBeUndefined();
        expect(Reflect.has(wrapped, key)).toBe(false);
      }
    });

    test.each([null, 7])('rejects the invalid JavaScript fixture %s', (fixture) => {
      expect(() => Reflect.apply(mock, undefined, [fixture])).toThrow(TypeError);
    });
  });

  describe('basic functionality', () => {
    test('should allow assignment to itself even with private parts', () => {
      const mockObject: Mocked<TestClass> = mock<TestClass>();
      new TestClass(1).ofAnother(mockObject);
      expect(mockObject.getNumber).toHaveBeenCalledTimes(1);
    });

    test('should create vi.fn() without any invocation', () => {
      const mockObject = mock<ArbitraryMock>();
      expect(mockObject.getNumber).toHaveBeenCalledTimes(0);
    });

    test('should register invocations correctly', () => {
      const mockObject: ArbitraryMock = mock<ArbitraryMock>();
      mockObject.getNumber();
      mockObject.getNumber();
      expect(mockObject.getNumber).toHaveBeenCalledTimes(2);
    });
  });

  describe('mock return values and arguments', () => {
    test('should allow mocking a return value', () => {
      const mockObject = mock<ArbitraryMock>();
      mockObject.getNumber.mockReturnValue(12);
      expect(mockObject.getNumber()).toBe(12);
    });

    test('should allow specifying arguments', () => {
      const mockObject = mock<ArbitraryMock>();
      mockObject.getSomethingWithArgs(1, 2);
      expect(mockObject.getSomethingWithArgs).toBeCalledWith(1, 2);
    });
  });

  describe('mock properties', () => {
    test('should allow setting properties', () => {
      const mockObject = mock<ArbitraryMock>();
      mockObject.id = 17;
      expect(mockObject.id).toBe(17);
    });

    test('should allow setting boolean properties to false or null', () => {
      const mockObject = mock<ArbitraryMock>({ someValue: false });
      const mockObj2 = mock<ArbitraryMock>({ someValue: null });
      expect(mockObject.someValue).toBe(false);
      expect(mockObj2.someValue).toBe(null);
    });

    test('should allow setting properties to undefined explicitly', () => {
      const mockObject = mock<ArbitraryMock>({ someValue: undefined });
      expect(mockObject.someValue).toBe(undefined);
    });
  });

  describe('mock implementation', () => {
    test('should allow providing mock implementations for properties', () => {
      const mockObject = mock<TestClass>({ id: 61 });
      expect(mockObject.id).toBe(61);
    });

    test('should allow providing mock implementations for functions', () => {
      const mockObject = mock<TestClass>({ getNumber: () => 150 });
      expect(mockObject.getNumber()).toBe(150);
    });
  });

  describe('accessor implementations', () => {
    test.each([false, undefined])(
      'preserves a getter returning %s without reading it during initialization',
      (value) => {
        let reads = 0;
        const implementation = {
          get enabled() {
            reads += 1;
            return value;
          },
        };
        const descriptor = Object.getOwnPropertyDescriptor(implementation, 'enabled');

        const mockObject = mock(implementation);

        expect(reads).toBe(0);
        expect(Object.getOwnPropertyDescriptor(mockObject, 'enabled')).toEqual(descriptor);
        expect(mockObject.enabled).toBe(value);
        expect(reads).toBe(1);
      }
    );

    test.each([true, false])(
      'preserves getter and setter behavior with configurable=%s',
      (configurable) => {
        let value = false;
        let reads = 0;
        let writes = 0;
        const implementation = Object.create(null, {
          enabled: {
            enumerable: true,
            configurable,
            get() {
              reads += 1;
              return value;
            },
            set(nextValue: boolean) {
              writes += 1;
              value = nextValue;
            },
          },
        });
        const descriptor = Object.getOwnPropertyDescriptor(implementation, 'enabled');

        const mockObject = mock<{ enabled: boolean }>(implementation);

        expect(reads).toBe(0);
        expect(writes).toBe(0);
        expect(Object.getOwnPropertyDescriptor(mockObject, 'enabled')).toEqual(descriptor);
        mockObject.enabled = true;
        expect(writes).toBe(1);
        expect(mockObject.enabled).toBe(true);
        expect(reads).toBe(1);
      }
    );

    test.each([true, false])(
      'preserves a setter-only property with configurable=%s',
      (configurable) => {
        const received: boolean[] = [];
        const implementation = Object.create(null, {
          enabled: {
            enumerable: true,
            configurable,
            set(value: boolean) {
              received.push(value);
            },
          },
        });

        const mockObject = mock<{ enabled: boolean }>(implementation);

        expect(received).toEqual([]);
        expect(mockObject.enabled).toBeUndefined();
        mockObject.enabled = false;
        expect(received).toEqual([false]);
      }
    );

    test('preserves a non-configurable getter and rejects assignment', () => {
      let reads = 0;
      const implementation = Object.create(null, {
        enabled: {
          enumerable: true,
          configurable: false,
          get() {
            reads += 1;
            return false;
          },
        },
      });
      const mockObject = mock<{ enabled: boolean }>(implementation);

      expect(reads).toBe(0);
      expect(mockObject.enabled).toBe(false);
      expect(() => {
        mockObject.enabled = true;
      }).toThrow(TypeError);
      expect(mockObject.enabled).toBe(false);
    });

    test('preserves accessors inside a nested supplied implementation', () => {
      let reads = 0;
      const settings = {
        get enabled() {
          reads += 1;
          return false;
        },
      };
      const descriptor = Object.getOwnPropertyDescriptor(settings, 'enabled');

      const mockObject = mock({ settings });

      expect(reads).toBe(0);
      expect(Object.getOwnPropertyDescriptor(mockObject.settings, 'enabled')).toEqual(descriptor);
      expect(mockObject.settings.enabled).toBe(false);
      expect(reads).toBe(1);
    });

    test('returns an accessor-provided object without eagerly traversing it', () => {
      let reads = 0;
      const settings = { enabled: false };
      const implementation = {
        get settings() {
          reads += 1;
          return settings;
        },
      };

      const mockObject = mock(implementation);

      expect(reads).toBe(0);
      expect(mockObject.settings).toBe(settings);
      expect(reads).toBe(1);
    });

    test.each([true, false])(
      'deep mocks getter/setter objects lazily with configurable=%s',
      (configurable) => {
        let reads = 0;
        let writes = 0;
        let child: { nested: { read?: () => string } } = { nested: {} };
        const implementation = Object.create(null, {
          child: {
            enumerable: true,
            configurable,
            get() {
              reads += 1;
              return child;
            },
            set(value: typeof child) {
              writes += 1;
              child = value;
            },
          },
        });
        const descriptor = Object.getOwnPropertyDescriptor(implementation, 'child');
        const mockObject = mock<{ child: { nested: { read(): string } } }>(implementation);

        expect(reads).toBe(0);
        expect(writes).toBe(0);
        const firstChild = mockObject.child;
        expect(reads).toBe(1);
        firstChild.nested.read.mockReturnValue('first');
        expect(mockObject.child).toBe(firstChild);
        expect(mockObject.child.nested.read()).toBe('first');
        expect(writes).toBe(0);
        expect(Object.getOwnPropertyDescriptor(mockObject, 'child')).toEqual(descriptor);

        const originalChild = child;
        child = { nested: {} };
        const replacement = mockObject.child;
        expect(replacement).not.toBe(firstChild);
        expect(mockObject.child).toBe(replacement);
        replacement.nested.read.mockReturnValue('replacement');
        expect(mockObject.child.nested.read()).toBe('replacement');
        expect(firstChild.nested.read()).toBe('first');

        child = originalChild;
        expect(mockObject.child).toBe(firstChild);
        mockObject.child = firstChild;
        expect(writes).toBe(1);
        expect(mockObject.child).toBe(firstChild);
        expect(mockObject.child.nested.read()).toBe('first');
      }
    );

    test('supports spying on getter/setter objects without losing deep mocks', () => {
      let child: { read?: () => string } = {};
      const mockObject = mock<{ child: { read(): string } }>({
        get child() {
          return child;
        },
        set child(value) {
          child = value;
        },
      });
      const getter = vi.spyOn(mockObject, 'child', 'get');

      const firstChild = mockObject.child;
      firstChild.read.mockReturnValue('mocked');
      expect(getter).toHaveBeenCalledTimes(1);
      expect(mockObject.child.read()).toBe('mocked');
      expect(getter).toHaveBeenCalledTimes(2);

      getter.mockRestore();
      expect(mockObject.child).toBe(firstChild);
      expect(mockObject.child.read()).toBe('mocked');
    });

    test('preserves a non-enumerable accessor', () => {
      let reads = 0;
      const implementation = Object.create(null, {
        enabled: {
          enumerable: false,
          configurable: true,
          get() {
            reads += 1;
            return false;
          },
        },
      });
      const mockObject = mock<{ enabled: boolean }>(implementation);

      expect(reads).toBe(0);
      expect(Object.keys(mockObject)).not.toContain('enabled');
      expect(mockObject.enabled).toBe(false);
      expect(reads).toBe(1);
    });
  });

  describe('promises', () => {
    test('should successfully use mock for promises resolving', async () => {
      const mockObject = mock<ArbitraryMock>();
      mockObject.id = 17;

      const promiseMockObj = Promise.resolve(mockObject);

      await expect(promiseMockObj).resolves.toBeDefined();
      await expect(promiseMockObj).resolves.toMatchObject({ id: 17 });
    });

    test('should successfully use mock for promises rejecting', async () => {
      const mockError = mock<Error>();
      mockError.message = '17';
      const promiseMockObj = Promise.reject(mockError);

      await expect(promiseMockObj).rejects.toBeDefined();
      await expect(promiseMockObj).rejects.toBe(mockError);
      await expect(promiseMockObj).rejects.toHaveProperty('message', '17');
    });
  });

  describe('non-writable properties', () => {
    test('should skip non-writable non-configurable properties during mock initialization', () => {
      const impl = Object.create(null, {
        locked: { value: 'frozen', writable: false, configurable: false, enumerable: true },
      });
      const mockObject = mock<{ locked: string }>(impl);
      expect(mockObject.locked).toBe('frozen');
    });

    test('should not throw when proxy set is called on a non-writable non-configurable property', () => {
      const impl = Object.create(null, {
        locked: { value: 42, writable: false, configurable: false, enumerable: true },
      });
      const mockObject = mock<{ locked: number }>(impl);
      expect(() => {
        mockObject.locked = 42;
      }).not.toThrow();
      expect(mockObject.locked).toBe(42);
    });
  });

  describe('mocking a date objects', () => {
    test('should allow calling native date object methods', () => {
      const mockObject = mock({ date: new Date('2000-01-15') });
      expect(mockObject.date.getFullYear()).toBe(2000);
      expect(mockObject.date.getMonth()).toBe(0);
      expect(mockObject.date.getDate()).toBe(15);
    });
  });

  describe('mocking nested objects', () => {
    test('should allow mocking nested objects', () => {
      const mockObject = mock<Prisma>();

      mockObject.user.create({ id: '123', name: 'Mashu', age: 123 });

      expect(mockObject.user.create).toHaveBeenCalledTimes(1);
      expect(mockObject.user.create).toHaveBeenCalledWith({ id: '123', name: 'Mashu', age: 123 });
    });

    test('should allow mocking nested objects with promises', async () => {
      const mockObject = mock<Prisma>();

      mockObject.user.create.mockResolvedValue({ id: '123', name: 'Mashu', age: 123 });

      await expect(
        mockObject.user.create({ id: '123', name: 'Mashu', age: 123 })
      ).resolves.toMatchObject({ id: '123', name: 'Mashu', age: 123 });
    });

    test('should allow mocking nested objects with promises and rejections', async () => {
      const mockObject = mock<Prisma>();

      mockObject.user.create.mockRejectedValue(new Error('Some error'));

      await expect(mockObject.user.create({ id: '123', name: 'Mashu', age: 123 })).rejects.toThrow(
        'Some error'
      );
    });
  });
});
