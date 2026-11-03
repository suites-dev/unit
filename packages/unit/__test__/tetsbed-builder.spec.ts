import { adapter } from './assets/test-adapter.js';
import { testBedBuilderFactory } from '../src/testbed-builder.js';

const initiationStub = jest.fn();

class TargetClass {}

class FakeBuilderType {
  public constructor(
    private doublesAdapter: never,
    private unitMocker: never,
    private targetClass: never,
    private console: never
  ) {
    initiationStub(doublesAdapter, unitMocker, targetClass, console);
  }
}

describe('Testbed Builder Unit Spec', () => {
  let result: FakeBuilderType;

  beforeAll(async () => {
    result = testBedBuilderFactory(
      { test: __dirname + '/assets/test-adapter' } as never,
      { test: __dirname + '/assets/test-adapter' } as never,
      TargetClass
    ).create(FakeBuilderType as never);
  });

  it('should call the constructor of the fake builder type', async () => {
    expect(initiationStub).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.any(Object),
      TargetClass,
      expect.any(Object)
    );
    await expect(initiationStub.mock.calls[0][0]).resolves.toBe(adapter);
  });

  it('should create new testbed builder with the given fake builder type', () => {
    expect(result).toBeInstanceOf(FakeBuilderType);
  });
});
