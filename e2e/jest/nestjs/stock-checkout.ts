import 'reflect-metadata';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Inventory {
  available(): boolean {
    return true;
  }
}

@Injectable()
export class StockService {
  constructor(private readonly inventory: Inventory) {}

  available(): boolean {
    return this.inventory.available();
  }
}

@Injectable()
export class Checkout {
  caughtError: unknown;

  constructor(private readonly stock: StockService) {}

  available(): boolean {
    return this.stock.available();
  }

  availableOrFallback(): boolean {
    try {
      return this.available();
    } catch (error) {
      this.caughtError = error;
      return false;
    }
  }
}
