export const dependencyVerificationKey = Symbol.for('@suites/dependency-verification');

export type DependencyViolationReporter = (error: Error) => void;

export class DependencyVerificationError extends Error {
  public readonly errors: readonly unknown[];

  public constructor(
    public readonly violations: readonly Error[],
    suiteFailure?: unknown
  ) {
    const details = violations.map((error) => error.message).join('\n');
    super(`Suites Unit recorded dependency rule violations.\n${details}`);
    this.name = 'DependencyVerificationError';
    this.errors = suiteFailure === undefined ? violations : [suiteFailure, ...violations];
  }
}

/** @internal One ledger is owned by one native test file/suite integration. */
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
  }

  throw error;
}
