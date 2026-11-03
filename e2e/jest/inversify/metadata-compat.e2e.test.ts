import 'reflect-metadata';
import { inject, injectable, injectFromBase, named, tagged } from 'inversify';
import { TestBed } from '@suites/unit';

@injectable()
class Dependency {
  value(): string {
    return 'real';
  }
}

@injectable()
class ParentService {
  constructor(@inject(Dependency) public dependency: Dependency) {}
}

@injectable()
@injectFromBase()
class ChildService extends ParentService {}

const dependencyKey = Symbol('dependency');

@injectable()
class PropertyService {
  @inject(Dependency)
  @named('primary')
  @tagged('region', 'west')
  public [dependencyKey]: Dependency;
}

describe('Inversify metadata compatibility', () => {
  it('preserves explicitly inherited constructor injection', async () => {
    const { unit, unitRef } = await TestBed.solitary(ChildService).compile();
    const dependency = unitRef.get(Dependency);
    dependency.value.mockReturnValue('inherited mock');

    expect(unit.dependency).toBe(dependency);
    expect(unit.dependency.value()).toBe('inherited mock');
  });

  it('preserves symbol properties with combined named and tagged metadata', async () => {
    const { unit, unitRef } = await TestBed.solitary(PropertyService).compile();
    const dependency = unitRef.get(Dependency, { named: 'primary', region: 'west' });
    dependency.value.mockReturnValue('property mock');

    expect(unit[dependencyKey]).toBe(dependency);
    expect(unit[dependencyKey].value()).toBe('property mock');
  });
});
