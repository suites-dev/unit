import type { InjectableIdentifier } from '@suites/types.di';
import type { NestInjectableIdentifier } from './types.js';

export interface NestCustomToken {
  readonly index: number;
  readonly param: NestInjectableIdentifier | undefined;
}

export function resolveToken(
  token: NestInjectableIdentifier | undefined
): InjectableIdentifier | undefined {
  if (typeof token === 'object' && token !== null && 'forwardRef' in token) {
    return token.forwardRef();
  }
  return token;
}
