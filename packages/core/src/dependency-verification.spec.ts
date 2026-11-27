import {
  DependencyVerificationError,
  DependencyViolationLedger,
  dependencyVerificationKey,
  reportDependencyViolation,
} from './dependency-verification-internal.js';
import { createContext, runInContext } from 'node:vm';
import { DependencyVerification, subscribeDependencyViolationObserver } from './dependency-verification.js';

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
        code: 'ER052',
        severity: 'error',
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
      expect(stderr).not.toHaveBeenCalled();
      expect(scheduledFailures).toHaveLength(1);
      expect(scheduledFailures[0]).toThrow(expect.objectContaining({
        code: 'ER053',
        severity: 'error',
        message: expect.stringMatching(/dependency verification is not configured[\s\S]*setupFiles/i),
      }));

      expect(() => reportDependencyViolation(violation)).toThrow(violation);
      expect(stderr).not.toHaveBeenCalled();
      expect(scheduledFailures).toHaveLength(1);
    } finally {
      queue.mockRestore();
      stderr.mockRestore();
    }
  });

  it('retains undefined thrown by a suite alongside the guard', () => {
    const ledger = new DependencyViolationLedger();
    ledger.record(new Error('guarded access'));

    expect(ledger.finish(undefined)?.errors).toEqual([undefined, new Error('guarded access')]);
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

describe('runner integration lifecycle', () => {
  it('delivers the original violation after recording a safe reporting copy', () => {
    const verification = DependencyVerification.install(global);
    const original = new Error('forbidden access');
    const listener = jest.fn((error: Error) => {
      error.message = 'changed by observer';
      throw new Error('observer failed');
    });
    const remove = subscribeDependencyViolationObserver(global, listener);
    const deliveries: Error[] = [];
    const second = (error: Error) => deliveries.push(error);
    const removeDuplicate = subscribeDependencyViolationObserver(global, second);
    const removeSecond = subscribeDependencyViolationObserver(global, second);
    try {
      removeDuplicate();
      removeDuplicate();
      let caught: unknown;
      try {
        reportDependencyViolation(original);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toBe(original);
      expect(verification.finish()?.message).toContain('forbidden access');
    } finally {
      removeSecond();
      remove();
      verification.uninstall();
    }
  });

  it('subscribes before installation and isolates observers by test global', () => {
    const foreign = createContext({});
    const observer = runInContext('(error) => { globalThis.observed = error }', foreign);
    const unsubscribe = subscribeDependencyViolationObserver(foreign, observer);
    const otherListener = jest.fn();
    const removeOther = subscribeDependencyViolationObserver(global, otherListener);
    const verification = DependencyVerification.install(foreign);
    const error = new Error('foreign violation');
    try {
      Reflect.get(foreign, dependencyVerificationKey)(error);
      expect(foreign.observed).toBe(error);
      expect(otherListener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      removeOther();
      verification.uninstall();
    }
  });

  it('keeps the active installation when a previous one is removed first', () => {
    const first = DependencyVerification.install(global);
    const second = DependencyVerification.install(global);
    first.uninstall();
    try {
      expect(() => reportDependencyViolation(new Error('inner violation'))).toThrow('inner violation');
      expect(second.finish()?.message).toContain('inner violation');
      expect(first.finish()).toBeUndefined();
    } finally {
      second.uninstall();
    }
    expect(Reflect.has(global, dependencyVerificationKey)).toBe(false);
  });

  it('resumes the previous installation and restores the original property descriptor', () => {
    const getter = jest.fn();
    const descriptor = { configurable: true, enumerable: true, get: getter };
    Object.defineProperty(global, dependencyVerificationKey, descriptor);
    const first = DependencyVerification.install(global);
    const second = DependencyVerification.install(global);
    second.uninstall();
    second.uninstall();
    try {
      expect(() => reportDependencyViolation(new Error('outer violation'))).toThrow('outer violation');
      expect(first.finish()?.message).toContain('outer violation');
    } finally {
      first.uninstall();
    }
    expect(getter).not.toHaveBeenCalled();
    expect(Object.getOwnPropertyDescriptor(global, dependencyVerificationKey)).toMatchObject(descriptor);
  });

  it('leaves an independently installed replacement reporter in place', () => {
    const verification = DependencyVerification.install(global);
    const external = jest.fn();
    Object.defineProperty(global, dependencyVerificationKey, { configurable: true, value: external });
    verification.uninstall();
    expect(Reflect.get(global, dependencyVerificationKey)).toBe(external);
  });
});
