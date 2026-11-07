import { TestBed, type Mocked } from "@suites/unit";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import type { Redis } from "ioredis";
import { MyService } from ".";

describe("MyService", () => {
  let service: MyService;
  let redis: Mocked<Redis>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(MyService).compile();
    service = unit;
    redis = unitRef.get(getRedisConnectionToken());
  });

  describe("When calling myMethod", () => {
    it("Should not throw", async () => {
      const promise = service.myMethod();
      await expect(promise).resolves.toBe(undefined);
    });
  });
});
