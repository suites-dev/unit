const process = require('node:process');
const { TestEnvironment: NodeEnvironment } = require('jest-environment-node');
const { withDependencyVerification } = require('@suites/runners.jest/environment');

class CustomGuardEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    this.global.SUITES_CUSTOM_ENVIRONMENT = 'preserved';
  }

  async teardown() {
    await super.teardown();
    if (process.env.SUITES_TEST_TEARDOWN_FAILURE) throw new Error('Custom teardown failed');
  }

  handleTestEvent(event) {
    if (event.name === 'run_start') {
      this.global.SUITES_CUSTOM_EVENT = 'handled';
    }
  }
}

module.exports = withDependencyVerification(CustomGuardEnvironment);
