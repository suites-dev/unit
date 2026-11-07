import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { TestBed, type Mocked } from '@suites/unit';
import type { Redis } from 'ioredis';
import { beforeAll, describe, expect, it } from 'vitest';

const REDIS = 'RedisClient';

@Injectable()
class RedisService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async read(): Promise<string | null> {
    return this.redis.get('test');
  }
}

describe('Mocking a Redis client', () => {
  let service: RedisService;
  let redis: Mocked<Redis>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(RedisService).compile();
    service = unit;
    // Keep contextual inference of the full client: narrowing Redis or passing
    // an explicit generic here would miss the type-checking failure from #1078.
    redis = unitRef.get(REDIS);
  });

  it('configures and calls the inferred mock', async () => {
    redis.get.mockResolvedValue('value');
    await expect(service.read()).resolves.toBe('value');
    expect(redis.get).toHaveBeenCalledWith('test');
  });
});
