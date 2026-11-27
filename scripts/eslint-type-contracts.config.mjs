import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';

const stateTypes =
  ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)' +
  '[id.name=/^(ConstructionMode|SociableConfiguration|ResolverOptions|DependencyPathEntry|CompositionBoundary|InspectionResult|InspectionFailure|InspectionLocation)$/]';

const chainedAssertion = {
  selector:
    ':matches(TSAsExpression, TSTypeAssertion) > :matches(TSAsExpression, TSTypeAssertion).expression',
  message: 'Narrow or correct the source type instead of chaining type assertions.',
};

export default [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  {
    files: ['packages/**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': typescript },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: { 'no-restricted-syntax': ['error', chainedAssertion] },
  },
  {
    files: [
      'packages/types/di/src/index.ts',
      'packages/core/src/services/builders/sociable-unit-builder.ts',
      'packages/core/src/services/composition-boundary.ts',
      'packages/core/src/services/dependency-resolver.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        chainedAssertion,
        {
          selector: `${stateTypes} TSPropertySignature[optional=true]`,
          message: 'Represent state variants with a discriminant and required fields.',
        },
        {
          selector: `${stateTypes} TSPropertySignature[readonly!=true]`,
          message: 'Declare state fields readonly.',
        },
      ],
    },
  },
];
