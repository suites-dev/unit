import type { Type } from '@suites/types.common';
import type { ClassInjectable, DependencyInjectionAdapter } from '@suites/types.di';
import { FluentSolitaryTestBedBuilder } from './builders/solitary-unit-builder.js';
import { UnitMocker } from './unit-mocker.js';

const primary = { named: 'primary' } as never;
const secondary = { named: 'secondary' } as never;
const param = (metadata?: unknown): ClassInjectable =>
  ({ identifier: 'TOKEN', metadata, type: 'PARAM' }) as ClassInjectable;

class Consumer {
  constructor(
    readonly first: unknown,
    readonly second: unknown,
    readonly third: unknown
  ) {}
}

function builder(dependencies: ClassInjectable[]) {
  const adapter = {
    inspect: (type: Type) => ({
      list: () => (type === Consumer ? dependencies : []),
      resolve: () => undefined,
    }),
  } as DependencyInjectionAdapter;
  const doubles = Promise.resolve({
    mock: jest.fn((implementation: unknown) => implementation ?? {}),
    stub: jest.fn,
  });
  const warn = jest.fn();
  return {
    warn,
    testBed: new FluentSolitaryTestBedBuilder(
      doubles,
      new UnitMocker(doubles.then((adapter) => adapter.mock), Promise.resolve(adapter)),
      Consumer,
      { ...console, warn }
    ),
  };
}

describe('configured dependency usage warnings', () => {
  it.each(['auto', 'impl', 'final'] as const)(
    'does not warn when a qualified %s override satisfies repeated bare requests',
    async (mode) => {
      const { testBed, warn } = builder([param(), param()]);
      const selector = testBed.mock<{ label: string }>('TOKEN', primary);
      const supplied = { label: 'configured' };
      if (mode === 'auto') selector.auto();
      if (mode === 'impl') selector.impl(() => supplied);
      if (mode === 'final') selector.final(supplied);

      const { unit } = await testBed.compile();

      expect(unit.first).toBe(unit.second);
      expect(unit.first).toEqual(mode === 'auto' ? {} : supplied);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it('retains cache qualification when a configured entry also satisfies a bare request', async () => {
    const { testBed, warn } = builder([param(), param(primary), param(secondary)]);
    const supplied = { label: 'configured' };
    const { unit, unitRef } = await testBed
      .mock('TOKEN', primary)
      .impl(() => supplied)
      .compile();

    expect(unit.first).toBe(supplied);
    expect(unit.second).toBe(supplied);
    expect(unit.third).not.toBe(supplied);
    expect(unitRef.get('TOKEN', primary)).toBe(unit.second);
    expect(unitRef.get('TOKEN', secondary)).toBe(unit.third);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports unused qualifiers while recognizing exact qualified overrides', async () => {
    const { testBed, warn } = builder([param(primary)]);
    const used = { label: 'used' };
    const { unit } = await testBed
      .mock('TOKEN', primary)
      .impl(() => used)
      .mock('TOKEN', secondary)
      .auto()
      .compile();

    expect(unit.first).toBe(used);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("mock 'TOKEN'"));
  });

  it('keeps bare overrides unused when a qualified request has no exact match', async () => {
    const { testBed, warn } = builder([param(primary)]);
    const supplied = { label: 'bare' };
    const { unit } = await testBed.mock('TOKEN').impl(() => supplied).compile();

    expect(unit.first).not.toBe(supplied);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports only the shadowed duplicate even when both final values are identical', async () => {
    const { testBed, warn } = builder([param(primary), param(primary)]);
    const supplied = { label: 'shared' };
    const { unit } = await testBed
      .mock('TOKEN', primary)
      .final(supplied)
      .mock('TOKEN', primary)
      .final(supplied)
      .compile();

    expect(unit.first).toBe(supplied);
    expect(unit.second).toBe(supplied);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('recognizes a false final value selected through bare-token fallback', async () => {
    const { testBed, warn } = builder([param()]);
    const { unit } = await testBed.mock<boolean>('TOKEN', primary).final(false).compile();

    expect(unit.first).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still reports a configuration for an unreachable token', async () => {
    const { testBed, warn } = builder([param()]);
    await testBed.mock('UNREACHABLE').auto().compile();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("mock 'UNREACHABLE'"));
  });
});
