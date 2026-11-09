import type {} from '@suites/doubles.jest/unit';
import { TestBed, type ComposedTestBedBuilder, type FluentMockOverride } from '@suites/unit';
import type { Type, AbstractType } from '@suites/types.common';
class Service {
  name = 'service';
  read(): string {
    return '';
  }
}
class Wrong {
  read(): number {
    return 1;
  }
}
abstract class Port {
  abstract read(): string;
}
class Subject {
  run(): number {
    return 1;
  }
}
const first = TestBed.sociable(Subject);
const composed: ComposedTestBedBuilder<Subject> = first.compose();
const configured = composed
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('yes') }))
  .exclude(Service)
  .mock(Service)
  .final({ read: () => '' })
  .exclude(Service)
  .mock(Service)
  .auto()
  .exclude(Service);
// @ts-expect-error mode prevents selective exposure
configured.expose(Service);
// @ts-expect-error composition is already selected
configured.compose();
// @ts-expect-error excludes requires at least one identifier
configured.exclude();
// @ts-expect-error array form is not supported
configured.exclude([Service]);
const select = first
  .expose(Service)
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('x') }))
  .expose(Port, Service)
  .mock(Service)
  .auto()
  .expose('port', Service)
  .mock(Service)
  .final({ read: () => '' })
  .expose(Symbol('port'), Service);
// @ts-expect-error incompatible instance contract
first.expose(Port, Wrong);
// @ts-expect-error cannot construct abstract implementation
first.expose(Port, Port);
function generic<T>(token: AbstractType<T>, implementation: Type<T>) {
  return TestBed.sociable(Subject).expose(token, implementation);
}
async function run() {
  const { unit, unitRef } = await configured.compile();
  unit.run();
  // @ts-expect-error subject retained
  unit.noSuchMethod();
  unitRef.get(Service).read.mockReturnValue('yes');
  // @ts-expect-error wrong return value
  unitRef.get(Service).read.mockReturnValue(1);
  const { unit: other } = await select.compile();
  other.run();
}
void run;
void generic;

const selected: FluentMockOverride<Service, Subject> = TestBed.solitary(Subject).mock(Service);
selected.auto().compile();

const inferred = TestBed.solitary(Subject).mock(Service);
// @ts-expect-error Class-token inference retains scalar property types.
inferred.impl(() => ({ name: 1 }));
// @ts-expect-error Final values retain scalar property types.
inferred.final({ name: 1 });
const qualified = TestBed.sociable(Subject)
  .compose()
  .mock<Service>('service', { named: 'primary' });
qualified.impl((stub) => ({ read: stub().mockReturnValue('x') })).exclude(Service);
qualified.final({ read: () => 'x' }).exclude(Service);
qualified.auto().exclude(Service);
