import { aroundAll } from 'vitest';
import {
  DependencyViolationLedger,
  dependencyVerificationKey,
} from '@suites/core.unit/verification';

const dependencyViolations = new DependencyViolationLedger();

Reflect.defineProperty(global, dependencyVerificationKey, {
  configurable: true,
  value: (error: Error) => dependencyViolations.record(error),
});

aroundAll(async (runSuite) => {
  let suiteFailure: unknown;
  try {
    await runSuite();
  } catch (error) {
    suiteFailure = error;
  } finally {
    Reflect.deleteProperty(global, dependencyVerificationKey);
  }

  const verificationFailure = dependencyViolations.finish(suiteFailure);
  if (verificationFailure !== undefined) {
    throw verificationFailure;
  }
  if (suiteFailure !== undefined) {
    throw suiteFailure;
  }
});
