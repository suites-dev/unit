import type { Type } from '@suites/types.common';
import type { ClassInjectable, DependencyInjectionAdapter } from '@suites/types.di';
import { DependencyContainer } from './dependency-container.js';
import { DependencyResolver } from './dependency-resolver.js';

class Provider {}
class Root {
  constructor(
    readonly first: Provider,
    readonly second: Provider
  ) {}
}

const primary = { named: 'primary' } as never;
const secondary = { named: 'secondary' } as never;

function adapterFor(target: Type, dependencies: ClassInjectable[]): DependencyInjectionAdapter {
  return {
    inspect: (type) => ({
      list: () => (type === target ? dependencies : []),
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
}

describe('qualified dependency resolution', () => {
  it('injects separate configured values for two occurrences of the same class', () => {
    const first = { label: 'first' };
    const second = { label: 'second' };
    const resolver = new DependencyResolver(
      [],
      new DependencyContainer([
        [{ identifier: Provider, metadata: primary }, first],
        [{ identifier: Provider, metadata: secondary }, second],
      ]),
      adapterFor(Root, [
        { identifier: Provider, metadata: primary, type: 'PARAM' } as ClassInjectable,
        { identifier: Provider, metadata: secondary, type: 'PARAM' } as ClassInjectable,
      ]),
      jest.fn()
    );

    const root = resolver.instantiateClass(Root) as unknown as Root;
    expect(root.first).toBe(first);
    expect(root.second).toBe(second);
    expect(resolver.getResolutionSummary().notFound).toEqual([]);
  });

  it('reuses a mock only when both identifier and metadata match', () => {
    const mock = jest.fn(() => ({}));
    const resolver = new DependencyResolver(
      [],
      new DependencyContainer([]),
      adapterFor(Root, []),
      mock
    );
    const first = resolver.resolveOrMock(Provider, primary);
    const second = resolver.resolveOrMock(Provider, secondary);

    expect(first).not.toBe(second);
    expect(resolver.resolveOrMock(Provider, { named: 'primary' } as never)).toBe(first);
    expect(resolver.resolveOrMock(Provider, { named: 'secondary' } as never)).toBe(second);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('reports a configured metadata variant that was not reached', () => {
    const resolver = new DependencyResolver(
      [],
      new DependencyContainer([
        [{ identifier: Provider, metadata: primary }, { label: 'first' }],
        [{ identifier: Provider, metadata: secondary }, { label: 'second' }],
      ]),
      adapterFor(Root, []),
      jest.fn()
    );
    resolver.resolveOrMock(Provider, primary);

    expect(resolver.getResolutionSummary().notFound).toEqual([
      [{ identifier: Provider, metadata: secondary }, { label: 'second' }],
    ]);
  });

  it('reuses constructed providers only for equivalent metadata without rerunning constructors', () => {
    let constructions = 0;
    class RealProvider {
      constructor() {
        constructions += 1;
      }
    }
    const resolver = new DependencyResolver(
      [RealProvider],
      new DependencyContainer([]),
      adapterFor(RealProvider, []),
      jest.fn()
    );

    const first = resolver.instantiateClass(RealProvider, primary);
    const second = resolver.instantiateClass(RealProvider, secondary);
    const unqualified = resolver.instantiateClass(RealProvider);

    expect(first).toBeInstanceOf(RealProvider);
    expect(second).not.toBe(first);
    expect(unqualified).not.toBe(first);
    expect(unqualified).not.toBe(second);
    expect(resolver.instantiateClass(RealProvider, { named: 'primary' } as never)).toBe(first);
    expect(resolver.instantiateClass(RealProvider, { named: 'secondary' } as never)).toBe(second);
    expect(resolver.instantiateClass(RealProvider)).toBe(unqualified);
    expect(constructions).toBe(3);
  });

  it('keeps real instance qualification separate from injected property qualification', () => {
    class Leaf {}
    class RealProvider {
      nested!: Leaf;
    }
    const propertyMetadata = { named: 'property' } as never;
    const resolver = new DependencyResolver(
      [RealProvider],
      new DependencyContainer([]),
      adapterFor(RealProvider, [
        {
          identifier: Leaf,
          metadata: propertyMetadata,
          type: 'PROPERTY',
          property: { key: 'nested' },
        } as ClassInjectable,
      ]),
      jest.fn(() => ({}))
    );

    const first = resolver.resolveOrMock(RealProvider, primary) as unknown as RealProvider;
    const second = resolver.resolveOrMock(
      RealProvider,
      propertyMetadata
    ) as unknown as RealProvider;
    expect(first).toBeInstanceOf(RealProvider);
    expect(second).toBeInstanceOf(RealProvider);
    expect(first).not.toBe(second);
    expect(first.nested).toBe(second.nested);
    expect(resolver.resolveOrMock(RealProvider, primary)).toBe(first);
    expect(resolver.resolveOrMock(RealProvider, propertyMetadata)).toBe(second);
  });
});
