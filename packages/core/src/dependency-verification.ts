import {
  DependencyViolationLedger,
  dependencyVerificationKey,
} from './dependency-verification-internal.js';

/** Adapter-only lifecycle used by the supported Jest and Vitest integrations. */
export class DependencyVerification {
  private readonly dependencyViolations = new DependencyViolationLedger();

  private constructor(private readonly target: Parameters<typeof Reflect.get>[0]) {
    Reflect.defineProperty(this.target, dependencyVerificationKey, {
      configurable: true,
      value: (error: Error) => this.dependencyViolations.record(error),
    });
  }

  public static install(
    target: Parameters<typeof Reflect.get>[0]
  ): DependencyVerification {
    return new DependencyVerification(target);
  }

  public finish(suiteFailure?: unknown): Error | undefined {
    return this.dependencyViolations.finish(suiteFailure);
  }

  public uninstall(): void {
    Reflect.deleteProperty(this.target, dependencyVerificationKey);
    this.dependencyViolations.clear();
  }
}
