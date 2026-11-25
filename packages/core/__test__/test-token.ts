export class TestToken<T = unknown> {
  declare readonly valueType: T;

  constructor(readonly description: string) {}
}

declare module '@suites/types.di' {
  interface InjectableIdentifierRegistry<T> {
    readonly coreTestToken: TestToken<T>;
  }
}
