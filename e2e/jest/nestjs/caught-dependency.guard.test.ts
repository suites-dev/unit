import { appendFileSync } from 'node:fs';
import { env } from 'node:process';
import { Checkout, StockService } from './stock-checkout';
import { TestBed } from '@suites/unit';

it('continues after application code catches a dependency violation', async () => {
  const { unit } = await TestBed.sociable(Checkout).expose(StockService).compile();

  expect(unit.availableOrFallback()).toBe(false);
  if (env.SUITES_GUARD_STEPS_FILE) {
    appendFileSync(env.SUITES_GUARD_STEPS_FILE, 'jest:caught-fallback-asserted\n');
  }
});
