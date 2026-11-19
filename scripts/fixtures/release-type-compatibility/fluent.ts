import type {} from '@suites/doubles.jest/unit';
import { TestBed } from '@suites/unit';

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

const selected = TestBed.sociable(Subject)
  .expose(Service)
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('yes') }));

// @ts-expect-error V4 exposes concrete classes only.
TestBed.sociable(Subject).expose('port', Service);

async function run() {
  const { unit, unitRef } = await selected.compile();
  unit.run();
  // @ts-expect-error The subject retains its type.
  unit.noSuchMethod();
  unitRef.get(Service).read.mockReturnValue('yes');
  // @ts-expect-error The mocked method retains its return type.
  unitRef.get(Service).read.mockReturnValue(1);
}

const inferred = TestBed.solitary(Subject).mock(Service);
// @ts-expect-error Class-token inference retains scalar property types.
inferred.impl(() => ({ name: 1 }));
// @ts-expect-error Final values retain scalar property types.
inferred.final({ name: 1 });

void run;
