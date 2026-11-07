import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type { Redis } from "ioredis";

@Injectable()
export class MyService {
  public constructor(@InjectRedis() private readonly redis: Redis) {}

  public async myMethod(): Promise<string | null> {
    return await this.redis.get("test");
  }
}
