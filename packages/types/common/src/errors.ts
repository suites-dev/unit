/**
 * Stable error identifiers for Suites Unit, keyed by the condition a consumer can handle.
 *
 * @since 5.0.0
 */
export const UnitErrorCode = Object.freeze({
  /** Legacy code used by IdentifierNotFoundError (ER010) */
  IDENTIFIER_NOT_FOUND: 'ER010',
  /** No supported DI or doubles adapter found (ER020) */
  ADAPTER_NOT_FOUND: 'ER020',
  /** An installed adapter failed to load or returned an invalid contract (ER021) */
  ADAPTER_UNUSABLE: 'ER021',
  /** Dependency type could not be detected from metadata (ER30) */
  DEPENDENCY_IDENTIFIER_UNRESOLVED: 'ER30',
  /** An explicit injection token resolved to undefined (ER31) */
  INJECTION_TOKEN_UNDEFINED: 'ER31',
  /** A mock could not be retrieved from unitRef.get() (ER040) */
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

/** Stable warning identifiers for Suites Unit. */
export const UnitWarningCode = Object.freeze({
  UNUSED_SOLITARY_OVERRIDE: 'WR001',
});

/**
 * String literals emitted by Suites Unit errors.
 *
 * @since 5.0.0
 */
export type UnitErrorCode = (typeof UnitErrorCode)[keyof typeof UnitErrorCode];

/**
 * Base error class for all Suites framework errors. All specific error types extend this class,
 * providing a consistent error structure with error codes for identification and debugging.
 *
 * This error includes a code property that can be used to programmatically identify the error type,
 * making it easier to handle specific errors in application code.
 *
 * @since 3.0.0
 */
export class SuitesError extends Error {
  public readonly severity = 'error';

  public constructor(
    public readonly code: UnitErrorCode,
    title: string,
    message: string
  ) {
    super(`${title} (code ${code.toString()})\n${message}`);
    this.name = 'SuitesError';
  }
}

/**
 * Thrown when a dependency cannot be retrieved from the dependency container.
 *
 * This occurs when calling `unitRef.get()` with an identifier that doesn't exist in the test environment,
 * typically because the dependency was not mocked or exposed.
 *
 * @since 3.0.0
 * @see https://suites.dev/docs
 */
export class DependencyResolutionError extends SuitesError {
  public constructor(
    message: string,
    code: UnitErrorCode = UnitErrorCode.MOCK_LOOKUP_FAILED
  ) {
    super(code, 'Dependency resolution error', message);
    this.name = 'DependencyResolutionError';
  }
}
