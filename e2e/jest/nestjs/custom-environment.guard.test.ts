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

  available(): boolean {
    return this.inventory.available();
  }
}

it('preserves a custom environment while verifying the file', async () => {
  expect(Reflect.get(global, 'SUITES_CUSTOM_ENVIRONMENT')).toBe('preserved');
  expect(Reflect.get(global, 'SUITES_CUSTOM_EVENT')).toBe('handled');
  const { unit } = await TestBed.sociable(Checkout).compile();

  expect(() => unit.available()).toThrow(/Suites Unit rule violation:[^\n]*undeclared dependency/i);
});
