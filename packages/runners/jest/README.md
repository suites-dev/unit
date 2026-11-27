# @suites/runners.jest

Install this package alongside your Suites doubles adapter. Set Jest’s `testEnvironment` to `@suites/runners.jest`. To preserve a custom environment, export `withDependencyVerification(ExistingEnvironment)` from your environment module.

With the default Jest Circus runner, a caught violation fails the suite and keeps the individual assertion results. With `jest-jasmine2`, the environment reports pending violations during teardown. Jest exits with a failed suite and omits the individual test results for that file.
