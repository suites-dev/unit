import type { InjectableIdentifier } from '@suites/types.di';

/**
 * Represents a forward reference token used by NestJS for circular dependencies.
 *
 * @since 3.0.0
 * @see {@link https://docs.nestjs.com/fundamentals/circular-dependency | NestJS Circular Dependency}
 */
export type ForwardRefToken = { readonly forwardRef: () => InjectableIdentifier | undefined };

/**
 * Union type representing all valid NestJS injectable identifiers.
 *
 * @since 3.0.0
 */
export type NestInjectableIdentifier = ForwardRefToken | InjectableIdentifier;

/**
 * Type alias for the Reflect metadata API.
 *
 * @since 3.0.0
 */
export type MetadataReflector = typeof Reflect;

/**
 * Metadata type for NestJS dependency identifiers.
 *
 * NestJS doesn't use additional identifier metadata, so this type is `never`.
 *
 * @since 3.0.0
 */
export type IdentifierMetadata = never;

/**
 * Represents a reflected property with its injection metadata.
 *
 * @since 3.0.0
 */
export interface ReflectedProperty {
  /** The property key name */
  readonly key: string | symbol;
  /** The type or token to inject */
  readonly type: NestInjectableIdentifier | undefined;
}
