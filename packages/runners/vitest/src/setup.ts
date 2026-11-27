import { aroundAll } from 'vitest';
import { DependencyVerification } from '@suites/core.unit/verification';

const dependencyVerification = DependencyVerification.install(global);

aroundAll(async (runSuite) => {
  try {
    try {
      await runSuite();
    } catch (error) {
      throw dependencyVerification.finish(error) ?? error;
    }

    const failure = dependencyVerification.finish();
    if (failure !== undefined) {
      throw failure;
    }
  } finally {
    dependencyVerification.uninstall();
  }
});
