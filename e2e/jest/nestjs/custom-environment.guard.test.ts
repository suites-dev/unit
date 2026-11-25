import { expect, it } from '@jest/globals';
import { Checkout, StockService } from './stock-checkout';
import { TestBed } from '@suites/unit';

it('preserves a custom environment while verifying the file', async () => {
  expect(Reflect.get(global, 'SUITES_CUSTOM_ENVIRONMENT')).toBe('preserved');
  expect(Reflect.get(global, 'SUITES_CUSTOM_EVENT')).toBe('handled');
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(() => unit.available()).toThrow(/Suites Unit rule violation:[^\n]*undeclared dependency/i);
});
