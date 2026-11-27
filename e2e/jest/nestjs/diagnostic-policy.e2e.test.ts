import * as diagnostics from '@suites/types.common';

const { DependencyResolutionError, UnitErrorCode, UnitWarningCode } = diagnostics;

describe('Unit diagnostic codes', () => {
  it('preserves published identifiers for programmatic handling', () => {
    const token: 'ER31' = UnitErrorCode.INJECTION_TOKEN_UNDEFINED;
    expect(token).toBe('ER31');
    expect(diagnostics).not.toHaveProperty('SuitesErrorCode');
    expect(diagnostics).not.toHaveProperty('SuitesWarningCode');
    expect(Object.isFrozen(UnitErrorCode)).toBe(true);
    expect(Object.isFrozen(UnitWarningCode)).toBe(true);
    expect(UnitErrorCode).toEqual({
      IDENTIFIER_NOT_FOUND: 'ER010',
      ADAPTER_NOT_FOUND: 'ER020',
      ADAPTER_UNUSABLE: 'ER021',
      DEPENDENCY_IDENTIFIER_UNRESOLVED: 'ER30',
      INJECTION_TOKEN_UNDEFINED: 'ER31',
      MOCK_LOOKUP_FAILED: 'ER040',
      INVALID_BUILDER_ARGUMENT: 'ER041',
      CONFIGURATION_CONFLICT: 'ER042',
      UNREACHABLE_DECLARATION: 'ER043',
      DEPENDENCY_CYCLE: 'ER044',
      UNDECLARED_DEPENDENCY_ACCESS: 'ER050',
      FORBIDDEN_DEPENDENCY_ACCESS: 'ER051',
      DEPENDENCY_VERIFICATION_FAILED: 'ER052',
      VERIFICATION_NOT_CONFIGURED: 'ER053',
    });
    expect(new Set(Object.values(UnitErrorCode)).size).toBe(Object.keys(UnitErrorCode).length);
  });

  it('distinguishes a failed lookup from a warning about an unused solitary override', () => {
    expect(new DependencyResolutionError('missing')).toMatchObject({
      code: 'ER040',
      severity: 'error',
    });
    expect(UnitWarningCode.UNUSED_SOLITARY_OVERRIDE).toBe('WR001');
  });
});
