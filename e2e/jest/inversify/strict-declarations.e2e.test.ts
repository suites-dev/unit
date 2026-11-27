import 'reflect-metadata';
import nodeConsole from 'node:console';
import { describe, expect, it, jest } from '@jest/globals';
import { inject, injectable, named } from 'inversify';
import { TestBed } from '@suites/unit';

const PORT = Symbol('port');
const OTHER = Symbol('port');

@injectable()
class Leaf {}

@injectable()
class Root {
  constructor(
    @inject(Leaf) readonly leaf: Leaf,
    @inject(PORT) @named('primary') readonly primary: Leaf,
    @inject(PORT) @named('secondary') readonly secondary: Leaf
  ) {}
}

describe('sociable declaration validation', () => {
  const selector = () => TestBed.sociable(Root);

  it('rejects unreachable mocks, finals, bindings and exposures when compiling', async () => {
    const configure = jest.fn(() => ({}));
    for (const mode of [selector().expose(Leaf), selector().compose()]) {
      for (const declaration of [
        mode.mock(PORT, { named: 'absent' }).impl(configure),
        mode.mock(OTHER).final({}),
        mode.bind('absent', Leaf),
      ]) {
        await expect(declaration.compile()).rejects.toMatchObject({ code: 'ER043' });
      }
    }
    await expect(
      selector()
        .expose(class Outside {})
        .compile()
    ).rejects.toMatchObject({
      code: 'ER043',
    });
    expect(configure).toHaveBeenCalledTimes(0);
  });

  it('rejects two overrides that match the same qualified request before calling a factory', async () => {
    const configure = jest.fn(() => ({}));
    for (const mode of [selector().expose(Leaf), selector().compose()]) {
      const primary = mode.mock(PORT, { named: 'primary' }).impl(configure);
      await expect(
        primary.mock(PORT, { named: 'primary' }).final({}).compile()
      ).rejects.toMatchObject({
        code: 'ER042',
      });
    }
    expect(configure).toHaveBeenCalledTimes(0);
  });

  it('accepts distinct qualifiers and repeated identical declarations, even if a test never uses a dependency', async () => {
    const current = selector().compose().forbid(OTHER).forbid(OTHER);
    const primary = {};
    const secondary = {};
    const { unit } = await current
      .mock(PORT, { named: 'primary' })
      .final(primary)
      .mock(PORT, { named: 'secondary' })
      .final(secondary)
      .compile();
    expect(unit.primary).toBe(primary);
    expect(unit.secondary).toBe(secondary);
    await expect(current.bind(PORT, Leaf).bind(PORT, Leaf).compile()).resolves.toBeDefined();
  });

  it('rejects invalid builder arguments at the call site', () => {
    const initial = selector();
    const composed = initial.compose();
    for (const invoke of [
      () => Reflect.apply(initial.expose, initial, [Leaf, undefined]),
      () => Reflect.apply(composed.forbid, composed, [Leaf, null]),
      () => Reflect.apply(composed.bind, composed, [PORT, () => new Leaf()]),
      () => Reflect.apply(composed.bind, composed, [undefined, Leaf]),
      () => Reflect.apply(composed.mock, composed, []),
    ]) {
      expect(invoke).toThrow(expect.objectContaining({ code: 'ER041' }));
    }
  });

  it('warns for an unmatched solitary qualifier and still compiles', async () => {
    const warning = jest.spyOn(nodeConsole, 'warn').mockImplementation(() => undefined);
    try {
      await TestBed.solitary(Root)
        .mock(PORT, { named: 'primary' })
        .final({})
        .mock(PORT, { named: 'absent' })
        .final({})
        .compile();
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('WR001'));
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('absent'));
    } finally {
      warning.mockRestore();
    }
  });
});
