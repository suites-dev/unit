import { afterAll, describe, expect, it } from 'vitest';
import { Checkout, Inventory, StockService } from './stock-checkout.js';
import { TestBed } from '@suites/unit';
import { appendFileSync } from 'node:fs';
import { env } from 'node:process';

function recordStep(step: string): void {
  if (env.SUITES_GUARD_STEPS_FILE) appendFileSync(env.SUITES_GUARD_STEPS_FILE, `${step}\n`);
}

function expectCaughtGuard(unit: Checkout): void {
  expect(unit.availableOrFallback()).toBe(false);
  const caught = unit.caughtError;
  expect(caught).toBeInstanceOf(Error);
  if (!(caught instanceof Error)) throw new Error('Checkout did not catch an error');
  expect(caught.message).toMatch(/Cannot read available on undeclared dependency 'Inventory'/i);
  expect(caught.message).toMatch(/Dependency path:[^\n]*Checkout[^\n]*->[^\n]*StockService[^\n]*->[^\n]*Inventory/i);
}

afterAll(async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();
  expectCaughtGuard(unit);
  recordStep('vitest:teardown-caught');
});

it('allows a dependency to be injected without being used', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(unit).toBeInstanceOf(Checkout);
});

it('uses an explicitly exposed real dependency', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService, Inventory).compile();

  expect(unit.available()).toBe(true);
});

it.skip('does not verify a skipped test', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  unit.available();
});

it('fails even when an exception assertion catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(() => unit.available()).toThrow(/Suites Unit rule violation:[^\n]*undeclared dependency/i);
  recordStep('vitest:immediate-error-asserted');
});

it('fails even when application code catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expectCaughtGuard(unit);
  recordStep('vitest:application-catch-asserted');
});

describe('nested guard verification', () => {
  describe('an earlier sibling suite', () => {
    it('records a violation in a nested sibling suite', async () => {
      const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

      expectCaughtGuard(unit);
      recordStep('vitest:nested-sibling-caught');
    });
  });

  describe('a later sibling suite', () => {
    it('keeps verification installed for a later sibling suite', async () => {
      const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

      expectCaughtGuard(unit);
      recordStep('vitest:later-sibling-caught');
    });
  });
});

it.fails('fails despite the expected-failure annotation', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  unit.available();
});

let attempts = 0;
it('fails when a clean retry follows a caught guard', { retry: 1 }, async () => {
  if (++attempts === 1) {
    const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();
    expectCaughtGuard(unit);
    recordStep('vitest:retry-first-caught');
    throw new Error('Force a retry after the caught dependency guard');
  } else {
    expect(true).toBe(true);
    recordStep('vitest:retry-second-clean');
  }
});

it('fails when a caught guard is followed by a dynamic skip', async (context) => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expectCaughtGuard(unit);
  recordStep('vitest:dynamic-skip-after-guard');
  context.skip();
});

it('allows a clean dynamic skip', (context) => {
  context.skip();
});
