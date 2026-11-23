import {
  DependencyRuleViolationError,
  createGuardedDependency,
} from './guarded-dependency.js';
import {
  DependencyViolationLedger,
  dependencyVerificationKey,
} from '../dependency-verification.js';

class Checkout {}
class Inventory {}

afterEach(() => {
  Reflect.deleteProperty(global, dependencyVerificationKey);
});

describe('guarded dependencies', () => {
  it('permits injection until a business member is accessed', () => {
    const guard = createGuardedDependency('undeclared dependency', Inventory, undefined, [
      { identifier: Checkout },
      { identifier: Inventory },
    ]);

    expect(typeof guard).toBe('function');
    expect(() => Reflect.get(guard, 'available')).toThrow(
      expect.objectContaining({
        category: 'undeclared dependency',
        dependencyPath: [{ identifier: Checkout }, { identifier: Inventory }],
        identifier: Inventory,
        name: 'DependencyRuleViolationError',
        operation: 'read available on',
      })
    );
  });

  it('records access for file verification before throwing', () => {
    const ledger = new DependencyViolationLedger();
    Reflect.defineProperty(global, dependencyVerificationKey, {
      configurable: true,
      value: (error: Error) => ledger.record(error),
    });
    const guard = createGuardedDependency('forbidden dependency', Inventory, undefined, [
      { identifier: Checkout },
      { identifier: Inventory },
    ]);

    expect(() => Reflect.apply(guard, undefined, [])).toThrow(DependencyRuleViolationError);
    expect(ledger.finish()?.message).toMatch(/forbidden dependency 'Inventory'/i);
  });

  it('includes qualified identifiers and the dependency path in diagnostics', () => {
    const metadata = { named: 'primary' } as never;
    const guard = createGuardedDependency('undeclared dependency', 'INVENTORY', metadata, [
      { identifier: Checkout },
      { identifier: 'INVENTORY', metadata },
    ]);

    expect(() => Reflect.get(guard, 'available')).toThrow(
      /Cannot read available on undeclared dependency 'INVENTORY', with metadata.*Dependency path: 'Checkout' -> 'INVENTORY'/i
    );
  });
});
