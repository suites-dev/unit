import type {} from '@suites/doubles.jest/unit';
import {
  TestBed,
  type SociableTestBedBuilder,
} from '@suites/unit';
import type { SolitaryTestBedBuilder } from '@suites/core.unit';
import type { Type } from '@suites/types.common';

class Subject {
  run(): number {
    return 1;
  }
}

class Dependency {
  read(): string {
    return 'value';
  }
}

export class CustomSolitaryTestBed extends TestBed {
  static override solitary<T>(target: Type<T>): SolitaryTestBedBuilder<T> {
    return super.solitary(target);
  }
}

export class CustomSociableTestBed extends TestBed {
  static override sociable<T>(target: Type<T>): SociableTestBedBuilder<T> {
    return super.sociable(target);
  }
}

async function configure() {
  const solitary = await CustomSolitaryTestBed.solitary(Subject).compile();
  const selective = await CustomSociableTestBed.sociable(Subject).expose(Dependency).compile();
  const composed = await CustomSociableTestBed.sociable(Subject).compose().compile();
  solitary.unit.run();
  selective.unit.run();
  composed.unit.run();
  // @ts-expect-error Subclass factories retain the subject type.
  composed.unit.missing();
}

void configure;
