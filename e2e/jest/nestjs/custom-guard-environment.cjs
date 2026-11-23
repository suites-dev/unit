const { TestEnvironment: NodeEnvironment } = require('jest-environment-node');
const {
  withDependencyVerification,
} = require('@suites/doubles.jest/environment');

class CustomGuardEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    this.global.SUITES_CUSTOM_ENVIRONMENT = 'preserved';
  }

  handleTestEvent(event) {
    if (event.name === 'run_start') {
      this.global.SUITES_CUSTOM_EVENT = 'handled';
    }
  }
}

module.exports = withDependencyVerification(CustomGuardEnvironment);
