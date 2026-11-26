import {
  DependencyVerificationError,
  DependencyViolationLedger,
  dependencyVerificationKey,
  reportDependencyViolation,
} from './dependency-verification-internal.js';
import { DependencyVerification } from './dependency-verification.js';

const missingDependencyVerificationKey = Symbol.for(
  '@suites/dependency-verification-missing-reported'
);

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
  Reflect.deleteProperty(global, missingDependencyVerificationKey);
});

describe('dependency violation verification', () => {
  it('exposes one adapter lifecycle that installs, finishes, and uninstalls reporting', () => {
    const verification = DependencyVerification.install(global);
    const violation = new Error('guarded access');

    expect(() => reportDependencyViolation(violation)).toThrow(violation);
    expect(verification.finish()).toEqual(
      expect.objectContaining({
        name: 'DependencyVerificationError',
        violations: [violation],
      })
    );

    verification.uninstall();
    expect(Reflect.has(global, dependencyVerificationKey)).toBe(false);
  });

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

  it('keeps the original diagnostic and call site without giving runners application objects', () => {
    const ledger = new DependencyViolationLedger();
    const metadata = { named: 'primary' };
    const violation = Object.assign(new Error('guarded access'), { metadata });
    const stack = violation.stack;

    ledger.record(violation);
    violation.message = 'application changed the caught error';

    const result = ledger.finish();
    expect(result?.message).toContain('guarded access');
    expect(result?.violations[0].stack).toBe(stack);
    expect(result?.violations[0]).not.toHaveProperty('metadata');
    expect(violation.metadata).toBe(metadata);
  });

  it('schedules a one-time setup failure when runner integration is missing', () => {
    const violation = new Error('guarded access');
    const scheduledFailures: Array<() => void> = [];
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const queue = jest
      .spyOn(global, 'queueMicrotask')
      .mockImplementation((callback) => scheduledFailures.push(callback));

    try {
      expect(() => reportDependencyViolation(violation)).toThrow(violation);
      expect(stderr).toHaveBeenCalledWith(
        expect.stringMatching(/dependency verification is not configured.*setupFiles/i)
      );
      expect(scheduledFailures).toHaveLength(1);
      expect(scheduledFailures[0]).toThrow(/dependency verification is not configured/i);

      expect(() => reportDependencyViolation(violation)).toThrow(violation);
      expect(stderr).toHaveBeenCalledTimes(1);
      expect(scheduledFailures).toHaveLength(1);
    } finally {
      queue.mockRestore();
      stderr.mockRestore();
    }
  });

  it('retains an ordinary suite failure alongside violations', () => {
    const ledger = new DependencyViolationLedger();
    const suiteFailure = new Error('ordinary failure');
    const violation = new Error('guarded access');
    ledger.record(violation);

    const result = ledger.finish(suiteFailure);

    expect(result).toBeInstanceOf(DependencyVerificationError);
    expect(result?.errors).toEqual([suiteFailure, violation]);
    expect(result?.cause).toBe(suiteFailure);
  });
});
