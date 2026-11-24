# @suites/runners.jest

Install this package alongside your Suites doubles adapter. Set Jest’s `testEnvironment` to `@suites/runners.jest/environment`. To preserve a custom environment, export `withDependencyVerification(ExistingEnvironment)` from your environment module.

A caught dependency violation still fails the test file or suite.
