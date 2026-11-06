import { jest } from '@jest/globals';
import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { TestBed } from '@suites/unit';
import { mock } from '@suites/doubles.jest';

@Injectable()
class ConfigService {
  get isCli(): boolean {
    throw new Error('The real getter must not run');
  }
}

@Injectable()
class Application {
  constructor(public readonly config: ConfigService) {}

  isCli(): boolean {
    return this.config.isCli;
  }
}

describe('Supplied getter implementations', () => {
  it('configures a readonly getter through TestBed without assignment', async () => {
    let reads = 0;
    const { unit, unitRef } = await TestBed.solitary(Application)
      .mock(ConfigService)
      .impl(() => ({
        get isCli() {
          reads += 1;
          return false;
        },
      }))
      .compile();

    expect(reads).toBe(0);
    expect(unit.isCli()).toBe(false);
    expect(reads).toBe(1);
    const config = unitRef.get(ConfigService);
    jest.spyOn(config, 'isCli', 'get').mockReturnValue(true);
    expect(unit.isCli()).toBe(true);
  });

  it('supports a standalone configurable getter and a plain false value', () => {
    const config = mock<ConfigService>({
      get isCli() {
        return false;
      },
    });
    expect(config.isCli).toBe(false);
    jest.spyOn(config, 'isCli', 'get').mockReturnValue(true);
    expect(config.isCli).toBe(true);
    expect(mock<ConfigService>({ isCli: false }).isCli).toBe(false);
  });

  it('retains lazy defaults and allows defining a value on an existing mock', () => {
    const config = mock<ConfigService>();
    expect(config.isCli).toBeTruthy();
    Object.defineProperty(config, 'isCli', { value: false });
    expect(config.isCli).toBe(false);
  });
});
