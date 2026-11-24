import 'reflect-metadata';
import { expect, it } from '@jest/globals';
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

  availableOrFallback(): boolean {
    try {
      return this.inventory.available();
    } catch {
      return false;
    }
  }
}

it('fails closed when a caught guard has no Jest environment integration', async () => {
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(unit.availableOrFallback()).toBe(false);
});
