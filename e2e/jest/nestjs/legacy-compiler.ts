import type { SociableTestBedBuilder } from '@suites/unit';

declare const builder: SociableTestBedBuilder<{ run(): void }>;
class Logger {
  log(): void {}
}
abstract class Port {
  abstract read(): string;
}
class Implementation {
  read(): string {
    return 'real';
  }
}
class Incompatible {
  read(): number {
    return 42;
  }
}

builder.expose(Logger).compile();
builder.expose('port', Implementation).compile();
builder.expose(Port, Implementation).compile();

// @ts-expect-error The implementation must match the token's instance type.
builder.expose(Port, Incompatible);
// @ts-expect-error An abstract implementation cannot be constructed.
builder.expose(Port, Port);

async function preservesSubject() {
  const { unit } = await builder.expose(Port, Implementation).compile();
  unit.run();
  // @ts-expect-error Exposure retains the subject type.
  unit.nonexistentMethod();
}
void preservesSubject;
