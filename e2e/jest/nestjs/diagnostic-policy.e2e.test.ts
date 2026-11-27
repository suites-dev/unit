import { DependencyResolutionError, SuitesErrorCode, SuitesWarningCode } from '@suites/types.common';

describe('Suites diagnostic codes', () => {
  it('preserves published identifiers for programmatic handling', () => {
    const token: 'ER31' = SuitesErrorCode.UNDEFINED_TOKEN;
    expect(token).toBe('ER31');
    expect(Object.isFrozen(SuitesErrorCode)).toBe(true);
    expect(Object.isFrozen(SuitesWarningCode)).toBe(true);
    expect(SuitesErrorCode).toMatchObject({
      IDENTIFIER_NOT_FOUND: 'ER010',
      ADAPTER_NOT_FOUND: 'ER020',
      ADAPTER_ERROR: 'ER021',
      UNDEFINED_DEPENDENCY: 'ER30',
      DEPENDENCY_RESOLUTION_ERROR: 'ER040',
    });
    expect(new Set(Object.values(SuitesErrorCode)).size).toBe(Object.keys(SuitesErrorCode).length);
  });

  it('distinguishes a failed lookup from a warning about an unused solitary override', () => {
    expect(new DependencyResolutionError('missing')).toMatchObject({
      code: 'ER040',
      severity: 'error',
    });
    expect(SuitesWarningCode.UNUSED_SOLITARY_OVERRIDE).toBe('WR001');
  });
});
