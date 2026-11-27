import type { Type, AbstractType, ConstantValue } from '@suites/types.common';

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
  | AbstractType<TClass>
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
export type InjectableFinalValue = ConstantValue | AbstractType | UndefinedDependencySymbol;

/**
 * @since 3.0.0
 */
export type WithoutMetadata = {
  identifier: InjectableIdentifier;
  value: InjectableFinalValue;
  type: 'PROPERTY' | 'PARAM';
  property?: { readonly key: string | symbol };
};

/**
 * @since 3.0.0
 */
export type WithMetadata<Metadata extends IdentifierMetadata> = {
  identifier: InjectableIdentifier;
  value: InjectableFinalValue;
  type: 'PROPERTY' | 'PARAM';
  metadata: Metadata;
  property?: { readonly key: string | symbol };
};

/**
 * @since 3.0.0
 */
export type ClassInjectable<
  Metadata extends IdentifierMetadata = never,
  TIdentifier extends InjectableIdentifier = InjectableIdentifier,
> = TIdentifier extends AbstractType ? WithoutMetadata : WithMetadata<Metadata>;

/** Location reported by a DI adapter while inspecting a class. */
export type InspectionLocation =
  | { readonly kind: 'class' }
  | { readonly kind: 'parameter'; readonly index: number }
  | { readonly kind: 'property'; readonly key: string | symbol };

export interface InspectionFailure {
  readonly kind: 'failure';
  readonly reason:
    'undefined-dependency' | 'undefined-token' | 'unsupported-token' | 'invalid-metadata';
  readonly target: Type;
  readonly location: InspectionLocation;
  readonly cause: unknown;
}

export type InspectionResult =
  { readonly kind: 'success'; readonly registry: InjectableRegistry } | InspectionFailure;

export interface DependencyInjectionAdapter {
  inspect(targetClass: Type): InspectionResult;
  /**
   * Returns true when framework metadata identifies a class for automatic composition.
   * Adapters that omit this capability still support explicit construction through inspect().
   */
  canAutoConstruct?(targetClass: Type): boolean;
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
