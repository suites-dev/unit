import type { IdentifierMetadata, InjectableIdentifier } from '@suites/types.di';
import { types } from 'node:util';

// Coercing a user token can run application code before the runner records the violation.
function tokenName(identifier: InjectableIdentifier): string {
  if (typeof identifier === 'string' || typeof identifier === 'symbol') return String(identifier);
  if (types.isProxy(identifier)) return '[opaque token]';
  if (typeof identifier === 'function') {
    const name = Object.getOwnPropertyDescriptor(identifier, 'name')?.value;
    return typeof name === 'string' ? name : '[function]';
  }
  // InjectionJS stores its human-readable token description as an own data property.
  const description = Object.getOwnPropertyDescriptor(identifier, '_desc')?.value;
  if (typeof description !== 'string') return '[object token]';
  const prototype = Reflect.getPrototypeOf(identifier);
  if (prototype === null || types.isProxy(prototype)) return description;
  const ctor: unknown = Reflect.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
  if (typeof ctor !== 'function' || types.isProxy(ctor)) return description;
  const name: unknown = Reflect.getOwnPropertyDescriptor(ctor, 'name')?.value;
  return typeof name === 'string' && name && name !== 'Object' ? `${name} ${description}` : description;
}

function formatMetadata(metadata: IdentifierMetadata): string {
  if (types.isProxy(metadata)) return '[opaque]';
  const fields = Object.keys(metadata);
  if (fields.length > 8) return '[opaque]';
  return `{${fields
    .map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
      const value: unknown = descriptor?.value;
      const scalar = value === null || ['string', 'number', 'boolean'].includes(typeof value);
      return `${JSON.stringify(key)}:${scalar ? JSON.stringify(value) : '[opaque]'}`;
    })
    .join(',')}}`;
}

export function stringifyIdentifier(
  identifier: InjectableIdentifier,
  metadata: IdentifierMetadata | undefined
): string {
  try {
    const name = tokenName(identifier);
    return metadata === undefined
      ? `'${name}'`
      : `'${name}', with metadata ${formatMetadata(metadata)}`;
  } catch {
    // Reflection on an exotic object (such as an uninitialized module namespace) may throw.
    return metadata === undefined ? "'[opaque token]'" : "'[opaque token]', with metadata [opaque]";
  }
}
