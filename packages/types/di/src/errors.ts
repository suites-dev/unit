import type { Type } from '@suites/types.common';
import type { InspectionFailure } from './index.js';
import { SuitesError, UnitErrorCode } from '@suites/types.common';

export class IdentifierNotFoundError extends SuitesError {
  public constructor(message: string) {
    super(UnitErrorCode.IDENTIFIER_NOT_FOUND, 'Missing class dependency identifier', message);
    this.name = 'IdentifierNotFoundError';
  }
}

export interface InspectionContext {
  readonly root: Type;
  readonly failure: InspectionFailure;
}

abstract class DIInspectionError extends SuitesError {
  protected constructor(
    code: UnitErrorCode,
    title: string,
    message: string,
    public readonly context: InspectionContext | undefined
  ) {
    super(code, title, message);
    if (context && context.failure.cause !== undefined) {
      Object.defineProperty(this, 'cause', { value: context.failure.cause, configurable: true });
    }
  }
}

export class UndefinedDependencyError extends DIInspectionError {
  public constructor(message: string, context: InspectionContext | undefined = undefined) {
    super(
      UnitErrorCode.DEPENDENCY_IDENTIFIER_UNRESOLVED,
      'Undefined dependency identifier',
      message,
      context
    );
    this.name = 'UndefinedDependencyError';
  }
}

export class UndefinedTokenError extends DIInspectionError {
  public constructor(message: string, context: InspectionContext | undefined = undefined) {
    super(UnitErrorCode.INJECTION_TOKEN_UNDEFINED, 'Undefined token', message, context);
    this.name = 'UndefinedTokenError';
  }
}
