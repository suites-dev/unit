import type {} from '@suites/doubles.jest/unit';
import { SociableTestBedBuilder, SolitaryTestBedBuilder, UnitMocker } from '@suites/core.unit';
import type { MockOverride, TestBedBuilder } from '@suites/core.unit';
import type { Type } from '@suites/types.common';
import type { DependencyInjectionAdapter } from '@suites/types.di';
import type { DoublesAdapter } from '@suites/types.doubles';

class Subject {
  run(): number {
    return 1;
  }
}

class Service {
  read(): string {
    return '';
  }
}

declare const doubles: Promise<DoublesAdapter>;
declare const di: Promise<DependencyInjectionAdapter>;
const mocker = new UnitMocker(
  doubles.then((adapter) => adapter.mock),
  di
);
const sociable = new SociableTestBedBuilder(doubles, mocker, Subject, console);
const solitary = new SolitaryTestBedBuilder(doubles, mocker, Subject, console);

class CustomBuilder extends SociableTestBedBuilder<Subject> {
  override expose(
    first: Type,
    ...rest: Type[]
  ): ReturnType<SociableTestBedBuilder<Subject>['expose']> {
    return super.expose(first, ...rest);
  }
}

function configure<T>(builder: TestBedBuilder<T>): MockOverride<Service, T> {
  return builder.mock(Service);
}

sociable
  .expose(Service)
  .mock(Service)
  .final({ read: () => 'selective' })
  .compile();
sociable
  .compose()
  .mock(Service)
  .final({ read: () => 'composed' })
  .compile();
solitary
  .mock(Service)
  .final({ read: () => 'solitary' })
  .compile();
configure(solitary)
  .impl((stub) => ({ read: stub().mockReturnValue('configured') }))
  .compile();

void CustomBuilder;
