import { aroundAll } from 'vitest';
import { DependencyVerification } from '@suites/core.unit/verification';

const dependencyVerification = DependencyVerification.install(global);

aroundAll(async (runSuite) => {
  let suiteFailure: unknown;
  try {
    await runSuite();
  } catch (error) {
    suiteFailure = error;
  }

  const verificationFailure = dependencyVerification.finish(suiteFailure);
  dependencyVerification.uninstall();
  if (verificationFailure !== undefined) {
    throw verificationFailure;
  }
  if (suiteFailure !== undefined) {
    throw suiteFailure;
  }
});
