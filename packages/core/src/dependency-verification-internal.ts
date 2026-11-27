export const dependencyVerificationKey = Symbol.for('@suites/dependency-verification');
const missingDependencyVerificationKey = Symbol.for(
  '@suites/dependency-verification-missing-reported'
);

export type DependencyViolationReporter = (error: Error) => void;

export class DependencyVerificationError extends Error {
  public readonly errors: readonly unknown[];
  public readonly cause: unknown;

  public constructor(
    public readonly violations: readonly Error[],
    suiteFailure?: unknown
  ) {
    const details = violations.map((error) => error.message).join('\n');
    super(`Suites Unit recorded dependency rule violations.\n${details}`);
    this.name = 'DependencyVerificationError';
    this.cause = suiteFailure;
    this.errors = suiteFailure === undefined ? violations : [suiteFailure, ...violations];
  }
}

export class DependencyViolationLedger {
  private readonly violations: Error[] = [];

  public record(error: Error): void {
    this.violations.push(error);
  }

  public finish(suiteFailure?: unknown): DependencyVerificationError | undefined {
    if (this.violations.length === 0) {
      return undefined;
    }

    const error = new DependencyVerificationError([...this.violations], suiteFailure);
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
  } else {
    if (Reflect.get(global, missingDependencyVerificationKey) !== true) {
      Reflect.defineProperty(global, missingDependencyVerificationKey, {
        configurable: true,
        value: true,
      });
      const configurationError = new Error(
        "Suites Unit dependency verification is not configured. For Jest, set testEnvironment to '@suites/runners.jest'. For Vitest, add '@suites/runners.vitest' to setupFiles. The test process must fail because the immediate dependency violation may be caught."
      );
      process.stderr.write(`${configurationError.message}\n`);
      queueMicrotask(() => {
        throw configurationError;
      });
    }
  }

  throw error;
}
