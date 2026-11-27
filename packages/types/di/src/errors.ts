import { SuitesError, UnitErrorCode } from '@suites/types.common';

export class IdentifierNotFoundError extends SuitesError {
  public constructor(message: string) {
    super(UnitErrorCode.IDENTIFIER_NOT_FOUND, 'Missing class dependency identifier', message);
    this.name = 'IdentifierNotFoundError';
  }
}

export class UndefinedDependencyError extends SuitesError {
  public constructor(message: string) {
    super(UnitErrorCode.DEPENDENCY_IDENTIFIER_UNRESOLVED, 'Undefined dependency identifier', message);
    this.name = 'UndefinedDependencyError';
  }
}

export class UndefinedTokenError extends SuitesError {
  public constructor(message: string) {
    super(UnitErrorCode.DEPENDENCY_IDENTIFIER_UNRESOLVED, 'Undefined token', message);
    this.name = 'UndefinedTokenError';
  }
}
