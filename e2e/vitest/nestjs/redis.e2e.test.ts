import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { TestBed, type Mocked } from '@suites/unit';
import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

const REDIS = 'RedisClient';

@Injectable()
class RedisService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async read(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
}

describe('Redis mock inference (#1078)', () => {
  it('infers the full client from the assignment and configures its methods', async () => {
    const { unit, unitRef } = await TestBed.solitary(RedisService).compile();
    let redis: Mocked<Redis>;
    // Keep the full Redis type and contextual inference. Pick<Redis, 'get'> or
    // an explicit get<Redis>() would bypass the original compiler regression.
    redis = unitRef.get(REDIS);

    redis.get.mockResolvedValue('value');
    await expect(unit.read('test')).resolves.toBe('value');
    expect(redis.get).toHaveBeenCalledWith('test');

    redis.get.mockResolvedValue(null);
    await expect(unit.read('missing')).resolves.toBeNull();
  });
});
