import type { InjectableIdentifier } from '@suites/types.di';
import { DependencyMap } from './dependency-map.js';

class Provider {}

describe('Dependency Map qualification', () => {
  it('separates named bindings and reuses equivalent metadata', () => {
    const map = new DependencyMap();
    const first = { label: 'first' };
    const second = { label: 'second' };
    map.set(Provider, first, { named: 'first' } as never);
    map.set(Provider, second, { named: 'second' } as never);

    expect(map.get(Provider, { named: 'first' } as never)).toBe(first);
    expect(map.get(Provider, { named: 'second' } as never)).toBe(second);
    expect(map.has(Provider)).toBe(false);
    expect(map.get(Provider)).toBeUndefined();
  });

  it('includes symbol-keyed tags and all named/tagged metadata in cache identity', () => {
    const tag = Symbol('tag');
    const map = new DependencyMap();
    const first = { label: 'first' };
    const second = { label: 'second' };
    map.set(Provider, first, { named: 'primary', [tag]: 'one' } as never);
    map.set(Provider, second, { [tag]: 'two', named: 'primary' } as never);

    expect(map.get(Provider, { [tag]: 'one', named: 'primary' } as never)).toBe(first);
    expect(map.get(Provider, { named: 'primary', [tag]: 'two' } as never)).toBe(second);
    expect(map.has(Provider, { named: 'primary' } as never)).toBe(false);
    expect(map.has(Provider, { named: 'primary', [Symbol('tag')]: 'one' } as never)).toBe(false);
  });

  it('preserves runtime identifier identity', () => {
    const map = new DependencyMap();
    const first = { description: 'same' } as unknown as InjectableIdentifier;
    const second = { description: 'same' } as unknown as InjectableIdentifier;
    const firstSymbol = Symbol('same');
    const secondSymbol = Symbol('same');
    const value = { label: 'first' };
    map.set(first, value);
    map.set(firstSymbol, value);

    expect(map.get(first)).toBe(value);
    expect(map.has(second)).toBe(false);
    expect(map.get(firstSymbol)).toBe(value);
    expect(map.has(secondSymbol)).toBe(false);
  });

  it.each([false, 0, null, undefined])('records a qualified cached value of %s', (value) => {
    const map = new DependencyMap();
    map.set(Provider, value as never, { named: 'primary' } as never);

    expect(map.has(Provider, { named: 'primary' } as never)).toBe(true);
    expect(map.get(Provider, { named: 'primary' } as never)).toBe(value);
    expect(map.has(Provider, { named: 'secondary' } as never)).toBe(false);
  });
});
