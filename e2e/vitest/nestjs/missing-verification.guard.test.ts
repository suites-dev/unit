import { expect, it } from 'vitest';
import { Checkout, StockService } from './stock-checkout.js';
import { TestBed } from '@suites/unit';

it('fails closed when a caught guard has no Vitest setup integration', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(unit.availableOrFallback()).toBe(false);
});
