import 'reflect-metadata';
import { expect, it } from 'vitest';
import { Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';

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

  expect(() => unit.available()).toThrow();
});

it('fails even when application code catches the guard', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit.availableOrFallback()).toBe(false);
});

it.fails('fails despite the expected-failure annotation', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  unit.available();
});

let attempts = 0;
it('fails when a retry catches a guard', { retry: 1 }, async () => {
  if (++attempts === 1) throw new Error('Retry the checkout test');

  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit.availableOrFallback()).toBe(false);
});
