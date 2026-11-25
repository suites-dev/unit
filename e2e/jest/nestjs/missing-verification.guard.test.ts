import { expect, it } from '@jest/globals';
import { Checkout, StockService } from './stock-checkout';
import { TestBed } from '@suites/unit';

it('fails closed when a caught guard has no Jest environment integration', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(unit.availableOrFallback()).toBe(false);
});
