import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';

const stateTypes =
  ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)' +
  '[id.name=/^(ConstructionMode|SociableConfiguration|ResolverOptions|DependencyPathEntry|CompositionBoundary)$/]';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.cjs', '**/*.mjs'] },
  {
    files: [
      'packages/core/src/services/**/*.ts',
      'packages/unit/src/**/*.ts',
      'packages/types/di/src/**/*.ts',
      'packages/{di,doubles}/*/{metadata,unit}.d.ts',
    ],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': typescript },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(TSAsExpression, TSTypeAssertion) > :matches(TSAsExpression, TSTypeAssertion).expression',
          message: 'Narrow or correct the source type instead of chaining type assertions.',
        },
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
