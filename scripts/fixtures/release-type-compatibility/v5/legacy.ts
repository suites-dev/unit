import type {} from '@suites/doubles.jest/unit';
import {
  TestBed,
  type MockOverride,
  type SociableTestBedBuilder,
  type TestBedBuilder,
  type UnitTestBed,
} from '@suites/unit';

class Service {
  name = 'service';
  read(): string {
    return '';
  }
}

class Subject {
  run(): number {
    return 1;
  }
}

const initial: SociableTestBedBuilder<Subject> = TestBed.sociable(Subject);
const selective = initial.expose(Service);
const composed = TestBed.sociable(Subject).compose();
const selectiveBase: TestBedBuilder<Subject> = selective;
const composedBase: TestBedBuilder<Subject> = composed;

const configuredInitial: SociableTestBedBuilder<Subject> = initial
  .mock(Service)
  .final({ read: () => 'initial' });
const configuredSelective = selective
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('selective') }));
const configuredComposed = composed.mock(Service).final({ read: () => 'composed' });

// @ts-expect-error Selective mode cannot transition to recursive composition.
selective.compose();
// @ts-expect-error Composed mode cannot transition to selective exposure.
composed.expose(Service);
// @ts-expect-error Class-token inference preserves scalar property types.
initial.mock(Service).final({ name: 1 });

const override: MockOverride<Service, Subject, SociableTestBedBuilder<Subject>> = initial.mock(
  Service
);

async function run() {
  const result: UnitTestBed<Subject> = await override.final({ read: () => 'value' }).compile();
  result.unit.run();
  // @ts-expect-error The subject retains its type.
  result.unit.missing();
}

void run;
void selectiveBase;
void composedBase;
void configuredInitial;
void configuredSelective;
void configuredComposed;
