import { expect, it } from 'vitest';
import { mock } from '@suites/doubles.vitest';

interface Entry {
  quantity: number;
  reserve(): void;
}

it('creates independent mocks from a reused fixture and preserves its shared references', () => {
  const entry = Object.freeze({ quantity: 2 });
  const when = new Date('2020-01-02T03:04:05Z');
  const fixture = Object.freeze({ entry, alias: entry, entries: [entry], when });
  interface Order {
    entry: Entry;
    alias: Entry;
    entries: Entry[];
    when: Date;
  }
  const first = mock<Order>(fixture);
  const second = mock<Order>(fixture);

  expect(first.entry).toBe(first.alias);
  expect(first.entries[0]).toBe(first.alias);
  expect(Array.isArray(first.entries)).toBe(true);
  first.entry.reserve();
  expect(first.alias.reserve).toHaveBeenCalledTimes(1);
  expect(second.entry.reserve).not.toHaveBeenCalled();
  expect(entry).not.toHaveProperty('reserve');
  expect(fixture).not.toHaveProperty('_isMockObject');

  first.when.setUTCFullYear(2030);
  expect(when.getUTCFullYear()).toBe(2020);
  expect(second.when.getUTCFullYear()).toBe(2020);
  first.entries.pop();
  expect(fixture.entries).toHaveLength(1);
});

it('preserves cycles within one mock', () => {
  interface Branch {
    parent: Branch | null;
  }
  const implementation: Branch = { parent: null };
  implementation.parent = implementation;
  const branch = mock<Branch>(implementation);

  expect(branch.parent).toBe(branch);
  expect(implementation.parent).toBe(implementation);
});

it('keeps the original receiver for a supplied class accessor', () => {
  class Account {
    #balance = 1;
    get balance() {
      return this.#balance;
    }
    set balance(next: number) {
      this.#balance = next;
    }
  }
  const input = new Account();
  const account = mock<Account>(input);

  account.balance = 5;
  expect(account.balance).toBe(5);
  expect(input.balance).toBe(5);
});
