import { types } from 'node:util';
import {
  DependencyViolationLedger,
  dependencyVerificationKey,
} from './dependency-verification-internal.js';

type VerificationTarget = Parameters<typeof Reflect.get>[0];
type Observer = (error: Error) => void;
const observersKey = Symbol.for('@suites/core.unit/dependency-violation-observers');
const addLedgerKey = Symbol.for('@suites/core.unit/dependency-verification-add-ledger');

function observersOn(target: VerificationTarget): Set<unknown> | undefined {
  const registry: unknown = Reflect.getOwnPropertyDescriptor(target, observersKey)?.value;
  return types.isSet(registry) ? registry : undefined;
}

/**
 * Observe the original error synchronously after the active runner records a violation.
 * Pass the same test global used by the runner. Each subscription has its own unsubscribe function.
 */
export function subscribeDependencyViolationObserver(
  target: VerificationTarget,
  observer: (error: Error) => void
): () => void {
  const observers = observersOn(target) ?? new Set<Observer>();
  if (observers.size === 0) {
    Object.defineProperty(target, observersKey, { configurable: true, value: observers });
  }
  const subscription: Observer = (error) => observer(error);
  observers.add(subscription);
  return () => {
    if (observers.delete(subscription) && observers.size === 0 && observersOn(target) === observers) {
      Reflect.deleteProperty(target, observersKey);
    }
  };
}

function installLedger(target: VerificationTarget, ledger: DependencyViolationLedger): () => void {
  const previous = Reflect.getOwnPropertyDescriptor(target, dependencyVerificationKey);
  const current: unknown = previous?.value;
  if (typeof current === 'function') {
    const addLedger = Reflect.getOwnPropertyDescriptor(current, addLedgerKey)?.value;
    if (typeof addLedger === 'function') return addLedger(ledger);
  }

  const ledgers: DependencyViolationLedger[] = [];
  const report = (error: Error) => {
    const active = ledgers[ledgers.length - 1];
    if (active === undefined) return;
    active.record(error);
    const observers = observersOn(target);
    if (observers === undefined) return;
    for (const notify of Array.from(Set.prototype.values.call(observers))) {
      if (typeof notify !== 'function') continue;
      try {
        notify(error);
      } catch {
        // Each observer is independent. The caller must still receive the original error.
      }
    }
  };
  const addLedger = (next: DependencyViolationLedger) => {
    ledgers.push(next);
    return () => {
      const index = ledgers.indexOf(next);
      if (index === -1) return;
      ledgers.splice(index, 1);
      if (ledgers.length > 0) return;
      if (Reflect.getOwnPropertyDescriptor(target, dependencyVerificationKey)?.value !== report) return;
      if (previous === undefined) {
        Reflect.deleteProperty(target, dependencyVerificationKey);
      } else {
        Object.defineProperty(target, dependencyVerificationKey, previous);
      }
    };
  };
  Object.defineProperty(report, addLedgerKey, { value: addLedger });
  Object.defineProperty(target, dependencyVerificationKey, { configurable: true, value: report });
  return addLedger(ledger);
}

/** File-level verification lifecycle for runner integrations. */
export class DependencyVerification {
  private readonly dependencyViolations = new DependencyViolationLedger();
  private readonly removeLedger: () => void;

  private constructor(target: VerificationTarget) {
    this.removeLedger = installLedger(target, this.dependencyViolations);
  }

  public static install(target: VerificationTarget): DependencyVerification {
    return new DependencyVerification(target);
  }

  public finish(...suiteFailure: [] | [unknown]): Error | undefined {
    return this.dependencyViolations.finish(...suiteFailure);
  }

  public uninstall(): void {
    this.removeLedger();
    this.dependencyViolations.clear();
  }
}
