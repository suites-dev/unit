import type {} from '@suites/doubles.jest/unit';
import { Service, solitary, sociable, selector } from './declarations/helpers';

solitary()
  .mock(Service)
  .impl(() => ({}))
  .compile();
sociable()
  .mock(Service)
  .impl(() => ({}))
  .compile();
selector()
  .impl(() => ({}))
  .compile();
// @ts-expect-error Emitted declarations preserve the dependency type.
selector().final({ name: 1 });
