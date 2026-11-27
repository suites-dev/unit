import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { Checkout, Inventory, StockService } from './stock-checkout';
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
  expect(caught).toMatchObject({ code: 'ER050', severity: 'error' });
  if (!(caught instanceof Error)) throw new Error('Checkout did not catch an error');
  expect(caught.message).toMatch(/Cannot read available on undeclared dependency 'Inventory'/i);
  expect(caught.message).toMatch(/Dependency path:[^\n]*Checkout[^\n]*->[^\n]*StockService[^\n]*->[^\n]*Inventory/i);
}

jest.retryTimes(1);

afterAll(async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();
  expectCaughtGuard(unit);
  recordStep('jest:teardown-caught');
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
  recordStep('jest:immediate-error-asserted');
});

it('fails even when application code catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expectCaughtGuard(unit);
  recordStep('jest:application-catch-asserted');
});

describe('nested guard verification', () => {
  describe('an earlier sibling suite', () => {
    it('records a violation in a nested sibling suite', async () => {
      const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

      expectCaughtGuard(unit);
      recordStep('jest:nested-sibling-caught');
    });
  });

  describe('a later sibling suite', () => {
    it('keeps verification installed for a later sibling suite', async () => {
      const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

      expectCaughtGuard(unit);
      recordStep('jest:later-sibling-caught');
    });
  });
});

it.failing('fails despite the expected-failure annotation', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  unit.available();
});

let attempts = 0;
it('fails when a clean retry follows a caught guard', async () => {
  if (++attempts === 1) {
    const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();
    expectCaughtGuard(unit);
    recordStep('jest:retry-first-caught');
    throw new Error('Force a retry after the caught dependency guard');
  } else {
    expect(true).toBe(true);
    recordStep('jest:retry-second-clean');
  }
});
