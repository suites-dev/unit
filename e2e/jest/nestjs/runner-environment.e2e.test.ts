import { expect, it } from '@jest/globals';
import { TestEnvironment } from 'jest-environment-node';
import { withDependencyVerification } from '@suites/runners.jest';

it('preserves the consumer environment when adding Suites verification', () => {
  class ProjectEnvironment extends TestEnvironment {}
  const Environment = withDependencyVerification(ProjectEnvironment);

  expect(Environment.prototype).toBeInstanceOf(ProjectEnvironment);
});
