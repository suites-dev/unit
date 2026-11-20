import 'reflect-metadata';
import { expect, it } from 'vitest';
import { Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';
import { appendFileSync } from 'node:fs';
import { env } from 'node:process';

function recordStep(step: string): void {
  if (env.SUITES_GUARD_STEPS_FILE) appendFileSync(env.SUITES_GUARD_STEPS_FILE, `${step}\n`);
}

@Injectable()
class Inventory {
  available(): boolean {
    return true;
  }
}

@Injectable()
class Checkout {
  constructor(private readonly inventory: Inventory) {}

  available(): boolean {
    return this.inventory.available();
  }

  availableOrFallback(): boolean {
    try {
      return this.available();
    } catch {
      return false;
    }
  }
}

it('allows a dependency to be injected without being used', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit).toBeInstanceOf(Checkout);
});

it('uses an explicitly exposed real dependency', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(Inventory).compile();

  expect(unit.available()).toBe(true);
});

it('uses an explicitly mocked dependency', async () => {
  const { unit } = await TestBed.sociable(Checkout)
    .mock(Inventory)
    .impl((stubFn) => ({ available: stubFn().mockReturnValue(false) }))
    .compile();

  expect(unit.available()).toBe(false);
});

it.skip('does not verify a skipped test', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  unit.available();
});

it('fails even when an exception assertion catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(() => unit.available()).toThrow(/an undeclared dependency was used/i);
  recordStep('vitest:immediate-error-asserted');
});

it('fails even when application code catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit.availableOrFallback()).toBe(false);
  recordStep('vitest:application-catch-asserted');
});

it.fails('fails despite the expected-failure annotation', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  unit.available();
});

let attempts = 0;
it('fails when a clean retry follows a caught guard', { retry: 1 }, async () => {
  if (++attempts === 1) {
    const { unit } = await TestBed.sociable(Checkout).compile();
    expect(unit.availableOrFallback()).toBe(false);
    recordStep('vitest:retry-first-caught');
    throw new Error('Force a retry after the caught dependency guard');
  } else {
    expect(true).toBe(true);
    recordStep('vitest:retry-second-clean');
  }
});

it('fails when a caught guard is followed by a dynamic skip', async (context) => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit.availableOrFallback()).toBe(false);
  recordStep('vitest:dynamic-skip-after-guard');
  context.skip();
});

it('allows a clean dynamic skip', (context) => {
  context.skip();
});
