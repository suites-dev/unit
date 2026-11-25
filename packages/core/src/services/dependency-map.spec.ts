import { TestToken } from '../../__test__/test-token.js';
import { DependencyMap } from './dependency-map.js';

class Provider {}

describe('Dependency Map qualification', () => {
  it('separates named bindings and reuses equivalent metadata', () => {
    const map = new DependencyMap();
    const first = { label: 'first' };
    const second = { label: 'second' };
    map.set(Provider, first, { named: 'first' });
    map.set(Provider, second, { named: 'second' });

    expect(map.get(Provider, { named: 'first' })).toBe(first);
    expect(map.get(Provider, { named: 'second' })).toBe(second);
    expect(map.has(Provider)).toBe(false);
    expect(map.get(Provider)).toBeUndefined();
  });

  it('includes symbol-keyed tags and all named/tagged metadata in cache identity', () => {
    const tag = Symbol('tag');
    const map = new DependencyMap();
    const first = { label: 'first' };
    const second = { label: 'second' };
    map.set(Provider, first, { named: 'primary', [tag]: 'one' });
    map.set(Provider, second, { [tag]: 'two', named: 'primary' });

    expect(map.get(Provider, { [tag]: 'one', named: 'primary' })).toBe(first);
    expect(map.get(Provider, { named: 'primary', [tag]: 'two' })).toBe(second);
    expect(map.has(Provider, { named: 'primary' })).toBe(false);
    expect(map.has(Provider, { named: 'primary', [Symbol('tag')]: 'one' })).toBe(false);
  });

  it('preserves runtime identifier identity', () => {
    const map = new DependencyMap();
    const first = new TestToken('same');
    const second = new TestToken('same');
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
    map.set(Provider, value as never, { named: 'primary' });

    expect(map.has(Provider, { named: 'primary' })).toBe(true);
    expect(map.get(Provider, { named: 'primary' })).toBe(value);
    expect(map.has(Provider, { named: 'secondary' })).toBe(false);
  });
});
