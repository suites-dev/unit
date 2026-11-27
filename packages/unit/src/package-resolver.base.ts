import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SuitesError, UnitErrorCode } from '@suites/types.common';
import type { DependencyInjectionAdapter } from '@suites/types.di';
import type { DoublesAdapter } from '@suites/types.doubles';

export interface AdapterContract<T> {
  readonly kind: string;
  accepts(value: unknown): value is T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export const diContract: AdapterContract<DependencyInjectionAdapter> = {
  kind: 'dependency injection framework',
  accepts(value): value is DependencyInjectionAdapter {
    return (
      isObject(value) &&
      typeof value.inspect === 'function' &&
      (value.canAutoConstruct === undefined || typeof value.canAutoConstruct === 'function')
    );
  },
};

export const doublesContract: AdapterContract<DoublesAdapter> = {
  kind: 'mocking library',
  accepts(value): value is DoublesAdapter {
    return isObject(value) && typeof value.mock === 'function' && typeof value.stub === 'function';
  },
};

class AdapterNotFoundError extends SuitesError {
  public constructor(kind: string, packages: readonly string[]) {
    super(
      UnitErrorCode.ADAPTER_NOT_FOUND,
      'No compatible adapter found',
      `Install a Suites adapter for your ${kind}. Checked: ${packages.join(', ')}.`
    );
    this.name = 'AdapterNotFoundError';
  }
}

class AdapterLoadError extends SuitesError {
  public constructor(name: string, detail: string, cause?: unknown) {
    super(UnitErrorCode.ADAPTER_UNUSABLE, `Unable to load Suites adapter ${name}`, detail);
    this.name = 'AdapterLoadError';
    if (cause !== undefined)
      Object.defineProperty(this, 'cause', { value: cause, configurable: true, writable: true });
  }
}

export type PackageResolverStrategy = (name: string) => boolean;

// A broken entry point can make resolution fail even when the package is installed.
export function checkPackage(
  name: string,
  resolve: () => void,
  searchPaths: () => readonly string[] | null
): boolean {
  try {
    resolve();
    return true;
  } catch (cause) {
    if (searchPaths()?.some((path) => existsSync(join(path, name, 'package.json')))) {
      throw new AdapterLoadError(
        name,
        'The installed package entry point could not be resolved.',
        cause
      );
    }
    return false;
  }
}

export class PackageResolver<TAdapter> {
  public constructor(
    private readonly adapters: Readonly<Record<string, string>>,
    private readonly resolverStrategy: PackageResolverStrategy,
    private readonly contract: AdapterContract<TAdapter>
  ) {}

  public async resolveCorrespondingAdapter(): Promise<TAdapter> {
    const packages = Object.values(this.adapters);
    const name = packages.find((candidate) => this.resolverStrategy(candidate));
    if (name === undefined) throw new AdapterNotFoundError(this.contract.kind, packages);

    try {
      const module = await import(name);
      const adapter: unknown = module.adapter;
      if (this.contract.accepts(adapter)) return adapter;
    } catch (cause) {
      throw new AdapterLoadError(name, 'The installed adapter failed to initialize.', cause);
    }
    throw new AdapterLoadError(
      name,
      `Expected a named "adapter" export implementing the Suites adapter for your ${this.contract.kind}.`
    );
  }
}
