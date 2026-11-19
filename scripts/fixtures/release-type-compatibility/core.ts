import type {} from '@suites/doubles.jest/unit';
import { SociableTestBedBuilder, SolitaryTestBedBuilder, UnitMocker } from '@suites/core.unit';
import type { TestBedBuilder, MockOverride } from '@suites/core.unit';
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
  expose(dependency: typeof Service): SociableTestBedBuilder<Subject> {
    return super.expose(dependency);
  }
}
function configure<T>(builder: TestBedBuilder<T>): MockOverride<Service, T> {
  return builder.mock(Service);
}
sociable
  .expose(Service)
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('x') }))
  .compile();
solitary
  .mock(Service)
  .final({ read: () => 'x' })
  .compile();
configure(solitary)
  .impl((stub) => ({ read: stub().mockReturnValue('x') }))
  .compile();
void CustomBuilder;
