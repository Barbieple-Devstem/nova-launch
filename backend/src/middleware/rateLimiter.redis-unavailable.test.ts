import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const getRedis = vi.fn();
vi.mock("../lib/redis", () => ({
  createRedisClient: vi.fn(),
  getRedis,
}));

import {
  createRateLimiter,
  globalRateLimiter,
  webhookRateLimiter,
  webhookUserRateLimiter,
} from "./rateLimiter";

function request(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    path: "/webhooks",
    socket: { remoteAddress: "127.0.0.1" },
    headers: {},
    ...overrides,
  } as Request;
}

function response() {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: unknown) => { res.headers[name] = value; }),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res as Response & { headers: Record<string, unknown> };
}

function unavailableRedis() {
  return {
    pipeline: () => ({
      zremrangebyscore() { return this; },
      zadd() { return this; },
      zcard() { return this; },
      expire() { return this; },
      exec: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    }),
  } as any;
}

describe("rate limiters when Redis is unavailable", () => {
  it("fails open and logs a warning for the generic limiter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const next = vi.fn();
    await createRateLimiter(unavailableRedis(), { windowMs: 60_000, max: 10 })(request(), response(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Redis unavailable"), expect.objectContaining({ keyPrefix: "rl" }));
    warn.mockRestore();
  });

  it.each([
    ["global", globalRateLimiter, { path: "/api" }],
    ["webhook", webhookRateLimiter, { path: "/webhooks" }],
    ["webhook user", webhookUserRateLimiter, { path: "/webhooks", user: { walletAddress: "GUSER" } }],
  ])("allows %s requests and warns when Redis is down", async (_name, limiter, overrides) => {
    getRedis.mockReturnValueOnce(unavailableRedis());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const next = vi.fn();
    const res = response();
    limiter(request(overrides as Partial<Request>), res, next);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("resumes rate-limit headers after Redis recovers", async () => {
    const recoveredRedis = {
      pipeline: () => ({
        zremrangebyscore() { return this; },
        zadd() { return this; },
        zcard() { return this; },
        expire() { return this; },
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
      }),
    } as any;
    getRedis.mockReturnValueOnce(unavailableRedis()).mockReturnValueOnce(recoveredRedis);
    const firstNext = vi.fn();
    globalRateLimiter(request(), response(), firstNext);
    await new Promise((resolve) => setImmediate(resolve));
    const recoveredResponse = response();
    const recoveredNext = vi.fn();
    globalRateLimiter(request(), recoveredResponse, recoveredNext);
    await new Promise((resolve) => setImmediate(resolve));
    expect(firstNext).toHaveBeenCalledOnce();
    expect(recoveredNext).toHaveBeenCalledOnce();
    expect(recoveredResponse.headers["X-RateLimit-Limit"]).toBeDefined();
  });
});
