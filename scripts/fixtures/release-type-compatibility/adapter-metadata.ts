/// <reference types="@suites/doubles.jest/metadata" />
/// <reference types="@suites/di.nestjs/metadata" />

import { mock as jestMock } from '@suites/doubles.jest';
import { mock as vitestMock } from '@suites/doubles.vitest';
import type { Mocked, UnitReference } from '@suites/unit';

class Service {
  read(): number {
    return 1;
  }
}

declare const unitRef: UnitReference;
const dependency: Mocked<Service> = unitRef.get(Service);
dependency.read.mockReturnValue(2);
// @ts-expect-error NestJS rejects qualifier metadata.
unitRef.get(Service, { named: 'other' });
// @ts-expect-error The selected adapter preserves the return type.
dependency.read.mockReturnValue('wrong');
jestMock<Service>().read.mockReturnValue(3);
vitestMock<Service>().read.mockReturnValue(4);
