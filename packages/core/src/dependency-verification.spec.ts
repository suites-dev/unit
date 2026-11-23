import {
  DependencyVerificationError,
  DependencyViolationLedger,
  dependencyVerificationKey,
  reportDependencyViolation,
} from './dependency-verification.js';

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
});

describe('dependency violation verification', () => {
  it('records a violation before the immediate error is thrown', () => {
    const ledger = new DependencyViolationLedger();
    const violation = new Error('guarded access');
    Reflect.defineProperty(global, dependencyVerificationKey, {
      configurable: true,
      value: (error: Error) => ledger.record(error),
    });

    expect(() => reportDependencyViolation(violation)).toThrow(violation);
    expect(ledger.finish()).toEqual(
      expect.objectContaining({
        name: 'DependencyVerificationError',
        violations: [violation],
      })
    );
  });

  it('does not require runner integration to throw the immediate violation', () => {
    const violation = new Error('guarded access');

    expect(() => reportDependencyViolation(violation)).toThrow(violation);
  });

  it('retains an ordinary suite failure alongside violations', () => {
    const ledger = new DependencyViolationLedger();
    const suiteFailure = new Error('ordinary failure');
    const violation = new Error('guarded access');
    ledger.record(violation);

    const result = ledger.finish(suiteFailure);

    expect(result).toBeInstanceOf(DependencyVerificationError);
    expect(result?.errors).toEqual([suiteFailure, violation]);
  });
});
