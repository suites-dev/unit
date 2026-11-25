import type {} from '@suites/doubles.jest/unit';
import { Service, composed, selective, selector, sociable, solitary } from './declarations/helpers';

solitary()
  .mock(Service)
  .final({ read: () => 'solitary' })
  .compile();
sociable().compose().compile();
selective()
  .mock(Service)
  .final({ read: () => 'selective' })
  .compile();
composed()
  .mock(Service)
  .final({ read: () => 'composed' })
  .compile();
selector()
  .final({ read: () => 'selected' })
  .compile();

// @ts-expect-error Emitted selective declarations do not expose compose().
selective().compose();
// @ts-expect-error Emitted composed declarations do not expose expose().
composed().expose(Service);
// @ts-expect-error Emitted declarations preserve the dependency type.
selector().final({ name: 1 });

composed().forbid(Service).compile();
selector()
  .final({ read: () => 'selected' })
  .forbid(Service)
  .compile();
// @ts-expect-error Only composed builders support forbid().
selective().forbid(Service);
