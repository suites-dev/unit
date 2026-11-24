import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';
import type { EnvironmentContext, JestEnvironment, JestEnvironmentConfig } from '@jest/environment';
import type { Circus } from '@jest/types';
import { DependencyVerification } from '@suites/core.unit/verification';

type EnvironmentConstructor = new (
  config: JestEnvironmentConfig,
  context: EnvironmentContext
) => JestEnvironment;

/** Adds file-level dependency verification while preserving the supplied environment. */
export function withDependencyVerification(
  Environment: EnvironmentConstructor
): EnvironmentConstructor {
  return class SuitesEnvironment extends Environment {
    private dependencyVerification: DependencyVerification | undefined;

    public constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
      super(config, context);
      const originalHandler = this.handleTestEvent?.bind(this);
      this.handleTestEvent = (event, state) => {
        const originalResult = originalHandler?.(event, state);
        if (event.name !== 'run_start') {
          return originalResult;
        }

        return Promise.resolve(originalResult).then(() => {
          this.installVerificationHook(state.rootDescribeBlock);
        });
      };
    }

    public async setup(): Promise<void> {
      await super.setup();
      this.dependencyVerification = DependencyVerification.install(this.global);
    }

    private installVerificationHook(rootDescribeBlock: Circus.DescribeBlock): void {
      rootDescribeBlock.hooks.push({
        asyncError: new Error('Suites Unit dependency verification'),
        fn: () => {
          const failure = this.dependencyVerification?.finish();
          if (failure !== undefined) {
            throw failure;
          }
        },
        parent: rootDescribeBlock,
        seenDone: false,
        timeout: undefined,
        type: 'afterAll',
      });
    }

    public async teardown(): Promise<void> {
      this.dependencyVerification?.uninstall();
      await super.teardown();
    }
  };
}

export default withDependencyVerification(NodeEnvironment);
