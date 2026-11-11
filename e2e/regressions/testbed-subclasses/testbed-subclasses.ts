import type {} from '@suites/doubles.jest/unit';
import { TestBed, type SociableTestBedBuilder } from '@suites/unit';
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
  static solitary<T = any>(target: Type<T>): SolitaryTestBedBuilder<T> {
    return super.solitary(target);
  }
}

export class CustomSociableTestBed extends TestBed {
  static sociable<T = any>(target: Type<T>): Pick<SociableTestBedBuilder<T>, 'expose'> {
    return super.sociable(target);
  }
}

async function configure() {
  const solitary = await CustomSolitaryTestBed.solitary(Subject).compile();
  const sociable = await CustomSociableTestBed.sociable(Subject).expose(Dependency).compile();
  solitary.unit.run();
  sociable.unit.run();
  // @ts-expect-error Subclass factories retain the subject type.
  solitary.unit.missing();
  // @ts-expect-error Subclass factories retain the subject type.
  sociable.unit.missing();
}

void configure;
