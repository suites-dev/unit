import type { Type, ConstantValue } from '@suites/types.common';

export * from './errors.js';

/**
 * @since 2.2.0
 */
export const UndefinedDependency: unique symbol = Symbol('UndefinedDependency');
export type UndefinedDependencySymbol = typeof UndefinedDependency;

/**
 * Additional identifier types supplied by a DI adapter's /metadata entry point.
 *
 * @template T - The dependency represented by the identifier.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- DI adapters populate this registry through module augmentation.
export interface InjectableIdentifierRegistry<T = unknown> {}

/** @since 3.0.0 */
export type InjectableIdentifier<TClass = unknown> =
  | Type<TClass>
  | string
  | symbol
  | InjectableIdentifierRegistry<TClass>[keyof InjectableIdentifierRegistry<TClass>];

/**
 * @since 3.0.0
 */
export type InjectableReflectedType = ConstantValue | Type | undefined;

/**
 * @since 3.0.0
 */
export type InjectableFinalValue = ConstantValue | Type | UndefinedDependencySymbol;

/**
 * @since 3.0.0
 */
export type WithoutMetadata = {
  identifier: InjectableIdentifier;
  value: InjectableFinalValue;
  type: 'PROPERTY' | 'PARAM';
  property?: Record<string, string>;
};

/**
 * @since 3.0.0
 */
export type WithMetadata<Metadata extends IdentifierMetadata> = {
  identifier: InjectableIdentifier;
  value: InjectableFinalValue;
  type: 'PROPERTY' | 'PARAM';
  metadata: Metadata;
  property?: Record<string, string>;
};

/**
 * @since 3.0.0
 */
export type ClassInjectable<
  Metadata extends IdentifierMetadata = never,
  TIdentifier extends InjectableIdentifier = InjectableIdentifier,
> = TIdentifier extends Type ? WithoutMetadata : WithMetadata<Metadata>;

/**
 * @since 3.0.0
 */
export interface DependencyInjectionAdapter {
  inspect(targetClass: Type): InjectableRegistry;
}

/**
 * Adapter metadata types registered through module augmentation.
 * Load the selected DI adapter's `/metadata` type entry point in a declaration file.
 *
 * @since 4.0.0
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- DI adapters populate this registry through module augmentation.
export interface IdentifierMetadataRegistry {}

/**
 * Metadata accepted by the selected DI adapter. Without an adapter reference,
 * metadata remains generic so the shared runtime can be built independently.
 *
 * @since 3.0.0
 */
export type IdentifierMetadata = keyof IdentifierMetadataRegistry extends never
  ? Record<string | symbol, unknown>
  : IdentifierMetadataRegistry[keyof IdentifierMetadataRegistry];

/**
 * @since 3.0.0
 */
export interface InjectableRegistry {
  resolve<T extends IdentifierMetadata>(
    identifier: InjectableIdentifier,
    metadata?: IdentifierMetadata
  ): ClassInjectable<T> | undefined;
  list<T extends IdentifierMetadata>(): ClassInjectable<T>[] | [];
}
