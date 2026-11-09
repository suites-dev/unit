import type {} from '@suites/doubles.jest/unit';
import {
  TestBed,
  type TestBedBuilder,
  type SociableTestBedBuilder,
  type SolitaryTestBedBuilder,
  type MockOverride,
  type UnitTestBed,
} from '@suites/unit';
import type { Type } from '@suites/types.common';
import type { InjectableIdentifier, IdentifierMetadata } from '@suites/types.di';
class Service {
  read(): string {
    return '';
  }
  nested = {
    save(): number {
      return 1;
    },
  };
  items = [
    {
      save(): number {
        return 1;
      },
    },
  ];
}
class Subject {
  run(): number {
    return 1;
  }
}
function configure<T>(builder: TestBedBuilder<T>): TestBedBuilder<T> {
  return builder.mock(Service).impl((stub) => ({ read: stub().mockReturnValue('yes') }));
}
function configureSociable<T>(builder: SociableTestBedBuilder<T>): TestBedBuilder<T> {
  return builder.mock(Service).final({ read: () => 'yes' });
}
function override<T>(builder: TestBedBuilder<T>): MockOverride<Service, T> {
  return builder.mock(Service);
}
function generic<T>(cls: Type<T>) {
  return configure(TestBed.solitary(cls));
}
const legacy: Pick<SociableTestBedBuilder<Subject>, 'expose'> = TestBed.sociable(Subject);
const solitary: SolitaryTestBedBuilder<Subject> = TestBed.solitary(Subject);
const sociable: SociableTestBedBuilder<Subject> = legacy.expose(Service);
const base: TestBedBuilder<Subject> = sociable;
async function run() {
  const { unit, unitRef } = await TestBed.solitary(Subject).compile();
  unit.run();
  // @ts-expect-error preserve subject
  unit.bad();
  unitRef.get(Service).read.mockReturnValue('yes');
  // @ts-expect-error correct return type
  unitRef.get(Service).read.mockReturnValue(123);
  unitRef.get(Service).items[0].save.mockReturnValue(1);
  const selected: MockOverride<Service, Subject> = solitary.mock(Service);
  const result: UnitTestBed<Subject> = await selected
    .impl((stub) => ({ read: stub().mockReturnValue('x') }))
    .compile();
  return result;
}
void run;
void generic;
void configureSociable;
void override;

const manual: MockOverride<Service, Subject> = {
  impl: (implementation) => solitary.mock(Service).impl(implementation),
  final: (implementation) => solitary.mock(Service).final(implementation),
};
interface CustomSociable<T> extends SociableTestBedBuilder<T> {
  expose(dependency: Type): SociableTestBedBuilder<T>;
}
interface CustomBuilder<T> extends TestBedBuilder<T> {
  mock<TDependency>(
    identifier: InjectableIdentifier<TDependency>,
    metadata?: IdentifierMetadata
  ): MockOverride<TDependency, T>;
}
void manual;
declare const customSociable: CustomSociable<Subject>;
declare const customBuilder: CustomBuilder<Subject>;
customSociable.expose(Service).compile();
customBuilder
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('x') }))
  .compile();
