module.exports = {
  preset: 'ts-jest',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js'],
  testRegex: '.e2e.test.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'Node10', isolatedModules: true, rootDir: '.', ignoreDeprecations: '6.0' } }],
    '^.+\\.m?js$': ['@swc/jest', { module: { type: 'commonjs' } }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(?:\\.pnpm/)?(?:@suites[+/]|inversify|@inversifyjs[+/]|@nestjs[+/]|uuid))'],
  testEnvironment: 'node',
};
