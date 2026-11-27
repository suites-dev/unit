import { SuitesError, SuitesErrorCode } from '@suites/types.common';

export const dependencyVerificationKey = Symbol.for('@suites/dependency-verification');
const missingDependencyVerificationKey = Symbol.for(
  '@suites/dependency-verification-missing-reported'
);

export type DependencyViolationReporter = (error: Error) => void;

export class DependencyVerificationError extends SuitesError {
  public readonly errors: readonly unknown[];
  public readonly cause: unknown;

  public constructor(
    public readonly violations: readonly Error[],
    ...suiteFailure: [] | [unknown]
  ) {
    const details = violations.map((error) => error.message).join('\n');
    super(
      SuitesErrorCode.DEPENDENCY_VERIFICATION_FAILED,
      'Suites Unit recorded dependency rule violations.',
      details
    );
    this.name = 'DependencyVerificationError';
    this.cause = suiteFailure[0];
    this.errors = [...suiteFailure, ...violations];
  }
}

export class DependencyViolationLedger {
  private readonly violations: Error[] = [];

  public record(error: Error): void {
    // Runners serialize recorded errors after the test. Keep application-owned tokens and
    // qualifiers on the immediate error, and retain the original guard call site here.
    const recorded = new Error(error.message);
    const code: unknown = Object.getOwnPropertyDescriptor(error, 'code')?.value;
    if (
      code === SuitesErrorCode.UNDECLARED_DEPENDENCY_ACCESS ||
      code === SuitesErrorCode.FORBIDDEN_DEPENDENCY_ACCESS
    ) {
      Object.defineProperties(recorded, {
        code: { value: code, enumerable: true },
        severity: { value: 'error', enumerable: true },
      });
    }
    recorded.name = error.name;
    recorded.stack = error.stack;
    this.violations.push(recorded);
  }

  public finish(...suiteFailure: [] | [unknown]): DependencyVerificationError | undefined {
    if (this.violations.length === 0) {
      return undefined;
    }

    const error = new DependencyVerificationError([...this.violations], ...suiteFailure);
    this.violations.length = 0;
    return error;
  }

  public clear(): void {
    this.violations.length = 0;
  }
}

/** Records before throwing, so catching the immediate error cannot erase the violation. */
export function reportDependencyViolation(error: Error): never {
  const reporter = Reflect.get(global, dependencyVerificationKey);
  if (typeof reporter === 'function') {
    reporter(error);
  } else if (Reflect.get(global, missingDependencyVerificationKey) !== true) {
    Reflect.defineProperty(global, missingDependencyVerificationKey, {
      configurable: true,
      value: true,
    });
    const configurationError = new SuitesError(
      SuitesErrorCode.VERIFICATION_NOT_CONFIGURED,
      'Suites Unit dependency verification is not configured.',
      "For Jest, set testEnvironment to '@suites/runners.jest/setup'. For Vitest, add '@suites/runners.vitest/setup' to setupFiles."
    );
    queueMicrotask(() => {
      throw configurationError;
    });
    // Without the setup hook, a runner's JSON report can omit unhandled errors.
    try {
      process.stderr.write(`${configurationError.message}\n`);
    } catch {
      // A closed output stream must preserve the original guard and the scheduled setup failure.
    }
  }

  throw error;
}
