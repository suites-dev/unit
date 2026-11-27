import { SolitaryTestBedBuilder } from '@suites/core.unit';
import { PackageResolver } from '../src/package-resolver.base.js';
import { adapter } from './assets/doubles-adapter.js';
import { testBedBuilderFactory } from '../src/testbed-builder.js';

const initiationStub = jest.fn();

class TargetClass {}

class FakeBuilderType {
  public constructor(
    doublesAdapter: unknown,
    unitMocker: unknown,
    targetClass: unknown,
    console: unknown
  ) {
    initiationStub(doublesAdapter, unitMocker, targetClass, console);
  }
}

describe('Testbed Builder Unit Spec', () => {
  let result: FakeBuilderType;

  beforeAll(async () => {
    result = testBedBuilderFactory(
      { test: __dirname + '/assets/test-adapter' },
      { test: __dirname + '/assets/doubles-adapter' },
      TargetClass
    ).create(FakeBuilderType);
  });

  it('should call the constructor of the fake builder type', async () => {
    expect(initiationStub).toHaveBeenCalledWith(
      expect.objectContaining({ then: expect.any(Function) }),
      expect.any(Object),
      TargetClass,
      expect.any(Object)
    );
    await expect(initiationStub.mock.calls[0][0]).resolves.toBe(adapter);
  });

  it('loads each adapter once for two concurrent compilations of one builder', async () => {
    const load = jest.spyOn(PackageResolver.prototype, 'resolveCorrespondingAdapter');
    try {
      const builder = testBedBuilderFactory(
        { test: __dirname + '/assets/test-adapter' },
        { test: __dirname + '/assets/doubles-adapter' },
        TargetClass
      ).create(SolitaryTestBedBuilder<TargetClass>);
      expect(load).not.toHaveBeenCalled();
      const [first, second] = await Promise.all([builder.compile(), builder.compile()]);
      expect(first.unit).toBeInstanceOf(TargetClass);
      expect(second.unit).not.toBe(first.unit);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      load.mockRestore();
    }
  });

  it('should create new testbed builder with the given fake builder type', () => {
    expect(result).toBeInstanceOf(FakeBuilderType);
  });
});
