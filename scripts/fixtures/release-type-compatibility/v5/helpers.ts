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
  return TestBed.sociable(Service);
}

export function selective() {
  return TestBed.sociable(Service).expose(Service);
}

export function composed() {
  return TestBed.sociable(Service).compose();
}

export function selector() {
  return TestBed.sociable(Service).compose().mock(Service);
}
