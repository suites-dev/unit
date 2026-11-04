import 'reflect-metadata';
import { ClassCtorReflector } from './class-ctor-reflector.js';
import { DependenciesAdapter } from './dependencies-adapter.js';

export type { IdentifierMetadata } from './types.js';

/** Constructor injection adapter for InjectionJS. */
export const adapter = DependenciesAdapter(ClassCtorReflector());
