import type { DoublesAdapter } from '@suites/types.doubles';
import { UnitWarningCode, type Type } from '@suites/types.common';
import { stringifyIdentifier } from '../functions.static.js';
import { UnitReference } from '../unit-reference.js';
import type { UnitMocker } from '../unit-mocker.js';
import type {
  IdentifierToMockOrFinal,
  IdentifierToMockImplWithCb,
} from '../dependency-container.js';
import { DependencyContainer } from '../dependency-container.js';
import type { UnitTestBed } from '../../types.js';
import { TestBedBuilder } from './testbed-builder.js';

export interface SolitaryTestBedBuilder<TClass> extends TestBedBuilder<TClass> {}

export class SolitaryTestBedBuilder<TClass>
  extends TestBedBuilder<TClass>
  implements TestBedBuilder<TClass>
{
  public constructor(
    private readonly doublesAdapter: PromiseLike<DoublesAdapter>,
    private readonly unitMocker: UnitMocker,
    private readonly targetClass: Type<TClass>,
    private readonly logger: Console
  ) {
    super();
  }

  public async compile(): Promise<UnitTestBed<TClass>> {
    const { mock: mockFn, stub: stubFn } = await this.doublesAdapter;

    const identifiersToMocksImpls: IdentifierToMockOrFinal[] = this.identifiersToBeMocked.map(
      ([identifier, mockImplCallback]: IdentifierToMockImplWithCb) => {
        return [identifier, mockFn(mockImplCallback(stubFn))];
      }
    );

    const identifiersToFinal: IdentifierToMockOrFinal[] = this.identifiersToBeFinalized.map(
      ([identifier, finalImpl]: IdentifierToMockOrFinal) => {
        return [identifier, finalImpl];
      }
    );

    const { container, instance, resolution } = await this.unitMocker.constructUnit<TClass>(
      this.targetClass,
      [],
      new DependencyContainer([...identifiersToMocksImpls, ...identifiersToFinal])
    );

    for (const entry of resolution.notFound) {
      const [{ identifier, metadata }] = entry;
      const kind = identifiersToFinal.includes(entry) ? 'final' : 'mock';
      const dependency = stringifyIdentifier(identifier, metadata);
      const root = stringifyIdentifier(this.targetClass, undefined);
      this.logger.warn(
        `Suites warning (${UnitWarningCode.UNUSED_SOLITARY_OVERRIDE}): Unused ${kind} override for ${dependency} in solitary test of ${root}. Remove the override or check its identifier and qualifier.`
      );
    }

    return {
      unit: instance as TClass,
      unitRef: new UnitReference(container, [], this.identifiersToBeFinalized),
    };
  }
}
