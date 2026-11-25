import type {} from '@suites/doubles.jest/unit';
import { TestBed, type Mocked } from '@suites/unit';

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

const selective = TestBed.sociable(Subject)
  .expose(Service)
  .mock(Service)
  .impl((stub) => ({ read: stub().mockReturnValue('yes') }));
const composed = TestBed.sociable(Subject)
  .compose()
  .mock(Service)
  .final({ read: () => 'yes' });

// @ts-expect-error Selective mode does not expose compose().
selective.compose();
// @ts-expect-error Composed mode does not expose expose().
composed.expose(Service);
// @ts-expect-error V5 selective exposure accepts concrete classes, not token bindings.
TestBed.sociable(Subject).expose('port', Service);

interface ServiceToken<T> {
  readonly serviceType: T;
}

declare module '@suites/types.di' {
  interface InjectableIdentifierRegistry<T> {
    readonly exampleAdapter: ServiceToken<T>;
  }
}

declare const token: ServiceToken<Service>;
const initial = TestBed.sociable(Subject);
// @ts-expect-error A mode must be selected before configuring a binding.
initial.bind(token, Service);
for (const mode of [initial.expose(Service), initial.compose()]) {
  mode
    .bind(token, Service)
    .mock(token)
    .final({ read: () => 'stub' });
  // @ts-expect-error A class token fixes the required implementation contract.
  mode.bind(Service, Subject);
  // @ts-expect-error An unregistered object cannot be used as a token.
  mode.bind({ unrelated: true }, Service);
  // @ts-expect-error The registered token carries its service contract.
  mode.bind(token, Subject);
}

async function run() {
  const selected = await selective.compile();
  const recursivelyComposed = await composed.compile();
  const selectedService: Mocked<Service> = selected.unitRef.get(Service);
  const composedService: Mocked<Service> = recursivelyComposed.unitRef.get(Service);
  const registered: Mocked<Service> = selected.unitRef.get(token);
  registered.read.mockReturnValue('registered');
  selectedService.read.mockReturnValue('selected');
  composedService.read.mockReturnValue('composed');
  selected.unit.run();
  recursivelyComposed.unit.run();
  // @ts-expect-error The subject retains its type.
  selected.unit.noSuchMethod();
}

void run;
