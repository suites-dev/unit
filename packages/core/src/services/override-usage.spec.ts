import type { DependencyInjectionAdapter } from '@suites/types.di';
import { DependencyContainer, type IdentifierToMockOrFinal } from './dependency-container.js';
import { DependencyResolver } from './dependency-resolver.js';

const adapter = {
  inspect: () => ({ list: () => [] }),
} as DependencyInjectionAdapter;

function resolver(entries: IdentifierToMockOrFinal[]) {
  return new DependencyResolver([], new DependencyContainer(entries), adapter, jest.fn);
}

describe('configured override usage', () => {
  it('recognizes a qualified override selected by a bare token', () => {
    const selected: IdentifierToMockOrFinal = [
      { identifier: 'TOKEN', metadata: { named: 'primary' } },
      { label: 'configured' },
    ];
    const current = resolver([selected]);

    expect(current.resolveOrMock('TOKEN')).toBe(selected[1]);
    expect(current.getResolutionSummary().notFound).toEqual([]);
  });

  it('reports only the unused override when two qualifiers are configured', () => {
    const selected: IdentifierToMockOrFinal = [
      { identifier: 'TOKEN', metadata: { named: 'primary' } },
      { label: 'selected' },
    ];
    const unused: IdentifierToMockOrFinal = [
      { identifier: 'TOKEN', metadata: { named: 'secondary' } },
      { label: 'unused' },
    ];
    const current = resolver([selected, unused]);

    expect(current.resolveOrMock('TOKEN', { named: 'primary' })).toBe(selected[1]);
    expect(current.getResolutionSummary().notFound).toEqual([unused]);
  });

  it('recognizes a false final value selected by a bare token', () => {
    const selected: IdentifierToMockOrFinal = [
      { identifier: 'TOKEN', metadata: { named: 'primary' } },
      false,
    ];
    const current = resolver([selected]);

    expect(current.resolveOrMock('TOKEN')).toBe(false);
    expect(current.getResolutionSummary().notFound).toEqual([]);
  });
});
