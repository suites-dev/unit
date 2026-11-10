import type {} from '@suites/doubles.jest/unit';
import { Service, solitary, sociable, composed, selector } from './declarations/helpers';

solitary().mock(Service).auto().compile();
sociable()
  .mock(Service)
  .impl(() => ({}))
  .expose('service', Service)
  .compile();
composed()
  .mock(Service)
  .final({ read: () => 'value' })
  .exclude(Service)
  .compile();
selector().auto().compile();
// @ts-expect-error Emitted declarations preserve the selected mode.
composed().expose(Service);
// @ts-expect-error Emitted declarations preserve the dependency type.
selector().final({ name: 1 });
