import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { TestBed, type Mocked } from '@suites/unit';

@Injectable()
class Repository {
  async find(id: string): Promise<string> {
    return id;
  }
}
@Injectable()
class Service {
  constructor(readonly repository: Repository) {}
}

async function checks() {
  const { unitRef } = await TestBed.solitary(Service).compile();
  const repository = unitRef.get(Repository);
  repository.find.mockResolvedValue('result');
  const typed: Mocked<Repository> = repository;
  typed.find.mockReturnValue(Promise.resolve('value'));
  // @ts-expect-error Mock return values must remain typed.
  repository.find.mockResolvedValue(123);
  // @ts-expect-error Constructor token inference must retain arguments.
  repository.find(123);
  // @ts-expect-error Return-value Promise members are not method members.
  repository.find.then;
  await TestBed.solitary(Service)
    .mock(Repository)
    .impl((stub) => ({ find: stub().mockResolvedValue('fake') }))
    .compile();
}
void checks;
