import 'reflect-metadata';
import { beforeEach, expect, it } from '@jest/globals';
import { Inject, Injectable, InjectionToken } from 'injection-js';
import { TestBed } from '@suites/unit';
import { appendFileSync } from 'node:fs';
import { env } from 'node:process';

function recordStep(step: string): void {
  if (env.SUITES_FORBID_STEPS_FILE) appendFileSync(env.SUITES_FORBID_STEPS_FILE, `${step}\n`);
}

@Injectable()
class Boundary {
  static constructed = 0;

  constructor() {
    Boundary.constructed += 1;
  }

  read(): string {
    return 'production';
  }
}

const AUDIT = new InjectionToken<Boundary>('AUDIT');

@Injectable()
class Layer {
  constructor(private readonly boundary: Boundary) {}

  safe(): string {
    return 'safe';
  }

  read(): string {
    return this.boundary.read();
  }
}

@Injectable()
class Checkout {
  constructor(private readonly layer: Layer) {}

  safe(): string {
    return this.layer.safe();
  }

  read(): string {
    return this.layer.read();
  }
}

@Injectable()
class TokenCheckout {
  constructor(@Inject(AUDIT) private readonly audit: Boundary) {}

  safe(): string {
    return 'safe';
  }

  read(): string {
    return this.audit.read();
  }
}

function expectForbidden(use: () => string, identifier: RegExp, path: RegExp): void {
  let caught: unknown;
  try {
    use();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  if (!(caught instanceof Error)) throw new Error('Forbidden access did not throw');
  expect(caught.message).toMatch(identifier);
  expect(caught.message).toMatch(path);
}

beforeEach(() => {
  Boundary.constructed = 0;
});

it('stops constructor traversal before constructing an unused forbidden boundary', async () => {
  const { unit } = await TestBed.sociable(Checkout).compose().forbid(Boundary).compile();

  expect(unit.safe()).toBe('safe');
  expect(Boundary.constructed).toBe(0);
});

it('rejects a mock and forbidden declaration for the same requested identifier', async () => {
  const compilation = TestBed.sociable(Checkout)
    .compose()
    .forbid(Boundary)
    .mock(Boundary)
    .final({ read: () => 'mocked' })
    .compile();

  await expect(compilation).rejects.toThrow(/conflicting.*Boundary/i);
});

it('rejects binding and forbidding the same token in either order', async () => {
  const token = Symbol('forbidden boundary');
  const boundFirst = TestBed.sociable(Checkout)
    .compose()
    .bind(token, Boundary)
    .forbid(token)
    .compile();
  const forbiddenFirst = TestBed.sociable(Checkout)
    .compose()
    .forbid(token)
    .bind(token, Boundary)
    .compile();

  await expect(boundFirst).rejects.toThrow(/conflicting.*forbidden boundary/i);
  await expect(forbiddenFirst).rejects.toThrow(/conflicting.*forbidden boundary/i);
});

const assertExposureAndCompositionAreMutuallyExclusive = (): void => {
  // @ts-expect-error forbidding dependencies requires recursive composition
  TestBed.sociable(Checkout).forbid(Boundary);

  const selective = TestBed.sociable(Checkout).expose(Boundary);
  // @ts-expect-error selective exposure cannot switch to recursive composition
  selective.compose();

  const composed = TestBed.sociable(Checkout).compose();
  // @ts-expect-error recursive composition cannot switch to selective exposure
  composed.expose(Boundary);
};
void assertExposureAndCompositionAreMutuallyExclusive;

it('keeps an InjectionToken boundary distinct from its implementation class', async () => {
  const { unit } = await TestBed.sociable(TokenCheckout).compose().forbid(AUDIT).compile();

  expect(unit.safe()).toBe('safe');
  expect(Boundary.constructed).toBe(0);
});

it('fails when a caught constructor-injected forbidden boundary is accessed', async () => {
  const { unit } = await TestBed.sociable(Checkout).compose().forbid(Boundary).compile();

  expectForbidden(
    unit.read.bind(unit),
    /forbidden dependency.*Boundary/i,
    /Dependency path:\s*'Checkout'\s*->\s*'Layer'\s*->\s*'Boundary'/i
  );
  recordStep(`${env.SUITES_FORBID_RUNNER}:constructor-caught`);
});

it('fails when a caught token forbidden boundary is accessed', async () => {
  const { unit } = await TestBed.sociable(TokenCheckout).compose().forbid(AUDIT).compile();

  expectForbidden(
    unit.read.bind(unit),
    /forbidden dependency.*AUDIT/i,
    /Dependency path:.*TokenCheckout.*AUDIT/i
  );
  recordStep(`${env.SUITES_FORBID_RUNNER}:token-caught`);
});

it('records caught access to a forbidden object token', async () => {
  const token = new InjectionToken<Boundary>('PAYMENTS');

  @Injectable()
  class PaymentCheckout {
    constructor(@Inject(token) readonly payments: Boundary) {}
  }

  const { unit } = await TestBed.sociable(PaymentCheckout).compose().forbid(token).compile();
  token.toString = () => {
    recordStep('diagnostic-hook-called');
    throw new Error('Token cannot be coerced');
  };

  expect(() => unit.payments.read()).toThrow();
});
