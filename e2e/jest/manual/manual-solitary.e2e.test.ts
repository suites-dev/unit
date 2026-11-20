/// <reference types="@suites/doubles.jest/unit" />
import { expect, it } from '@jest/globals';
import { TestBed } from '@suites/unit';

interface UserRepository {
  findName(id: string): Promise<string>;
}

interface Logger {
  info(message: string): void;
}

class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly logger: Logger
  ) {}

  async getName(id: string): Promise<string> {
    const name = await this.repository.findName(id);
    this.logger.info(`Found ${id}`);
    return name;
  }
}

class InheritedUserService extends UserService {}

class OverloadedLookup {
  constructor(id: string);
  constructor(id: number, source: string);
  constructor(
    private readonly id: string | number,
    private readonly source = 'primary'
  ) {}

  key(): string {
    return `${this.source}:${this.id}`;
  }
}

class GreetingService {
  private readonly titles: string[];

  constructor(
    private readonly name: string,
    private readonly greeting = 'Hello',
    private readonly punctuation?: string,
    ...titles: string[]
  ) {
    this.titles = titles;
  }

  greet(): string {
    return `${this.greeting}, ${[...this.titles, this.name].join(' ')}${this.punctuation ?? '!'}`;
  }
}

it('exercises an undecorated service with constructor mocks from the callback', async () => {
  const {
    unit,
    dependencies: [repository, logger],
  } = await TestBed.manual
    .solitary(UserService)
    .inject(({ mock }) => [mock<UserRepository>(), mock<Logger>()])
    .compile();

  repository.findName.mockResolvedValue('Ada');

  await expect(unit.getName('user-1')).resolves.toBe('Ada');
  expect(repository.findName).toHaveBeenCalledWith('user-1');
  expect(logger.info).toHaveBeenCalledWith('Found user-1');
});

it('supports default, optional, and rest constructor parameters', async () => {
  const { unit: defaultGreeting } = await TestBed.manual
    .solitary(GreetingService)
    .inject(() => ['Ada'])
    .compile();
  const { unit: titledGreeting } = await TestBed.manual
    .solitary(GreetingService)
    .inject(() => ['Ada', undefined, '?', 'Countess', 'Dr.'])
    .compile();

  expect(defaultGreeting.greet()).toBe('Hello, Ada!');
  expect(titledGreeting.greet()).toBe('Hello, Countess Dr. Ada?');
});

it('uses the inherited constructor with typed callback mocks', async () => {
  const {
    unit,
    dependencies: [repository, logger],
  } = await TestBed.manual
    .solitary(InheritedUserService)
    .inject(({ mock }) => [mock<UserRepository>(), mock<Logger>()])
    .compile();

  repository.findName.mockResolvedValue('Ada');
  await expect(unit.getName('user-1')).resolves.toBe('Ada');
  expect(unit).toBeInstanceOf(InheritedUserService);
  expect(logger.info).toHaveBeenCalledWith('Found user-1');
});

it('accepts either declared constructor overload', async () => {
  const { unit: byName } = await TestBed.manual
    .solitary(OverloadedLookup)
    .inject(() => ['ada'])
    .compile();
  const { unit: byId } = await TestBed.manual
    .solitary(OverloadedLookup)
    .inject(() => [42, 'archive'])
    .compile();

  expect(byName.key()).toBe('primary:ada');
  expect(byId.key()).toBe('archive:42');
});

// Checked by tsc without running invalid calls.
async function rejectsInvalidConstructorArgumentsAndMockValues(): Promise<void> {
  // @ts-expect-error The numeric overload requires its source argument.
  TestBed.manual.solitary(OverloadedLookup).inject(() => [42]);
  // @ts-expect-error The string overload accepts only the name.
  TestBed.manual.solitary(OverloadedLookup).inject(() => ['ada', 'archive']);

  // @ts-expect-error Elements in the rest parameter must match the constructor type.
  TestBed.manual.solitary(GreetingService).inject(() => ['Ada', undefined, undefined, 42]);

  const builder = TestBed.manual.solitary(UserService);
  // @ts-expect-error Constructor arguments must be in parameter order.
  builder.inject(({ mock }) => [mock<Logger>(), mock<UserRepository>()]);
  // @ts-expect-error Every required constructor argument must be supplied.
  builder.inject(({ mock }) => [mock<UserRepository>()]);

  const {
    dependencies: [repository, logger],
  } = await builder.inject(({ mock }) => [mock<UserRepository>(), mock<Logger>()]).compile();
  // @ts-expect-error The returned mock keeps the original method's result type.
  repository.findName.mockResolvedValue(42);
  // @ts-expect-error Dependencies preserve their individual types and tuple order.
  logger.findName('user-1');
}
