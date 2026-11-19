import type {} from '@suites/doubles.jest/unit';
import { TestBed } from '@suites/unit';

export class Service {
  name = 'service';
  read(): string {
    return 'value';
  }
}

export function solitary() {
  return TestBed.solitary(Service);
}

export function sociable() {
  return TestBed.sociable(Service).expose(Service);
}

export function selector() {
  return TestBed.solitary(Service).mock(Service);
}
