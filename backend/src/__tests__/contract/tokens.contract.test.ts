/**
 * OpenAPI contract tests — /api/tokens (Issue #2185).
 *
 * Every response is validated against `src/lib/openapi/spec.ts`; any drift
 * between a handler and its documentation fails the suite.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "contract-test-secret";
});

vi.mock("../../lib/prisma", () => ({
  prisma: {
    token: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../services/batchTokenDeployService", () => ({
  batchDeployTokens: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

import axios from "axios";
import tokenRoutes from "../../routes/tokens";
import { prisma } from "../../lib/prisma";
import { batchDeployTokens } from "../../services/batchTokenDeployService";
import { expectResponseToMatchSpec, findUndocumentedRoutes } from "../helpers/openapiContract";

const TENANT_ID = "GCREATOR1";
const TX_HASH = "a".repeat(64);

const app = express();
app.use(express.json());
app.use("/api/tokens", tokenRoutes);

const tokenRow = (id: string, createdAt: string) => ({
  id,
  address: `CTOKEN${id}`,
  creator: TENANT_ID,
  name: `Token ${id}`,
  symbol: `TK${id}`,
  decimals: 7,
  totalSupply: BigInt(1_000_000),
  initialSupply: BigInt(1_000_000),
  totalBurned: BigInt(250),
  burnCount: 2,
  metadataUri: id === "1" ? "ipfs://bafy" : null,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
});

const deployInput = {
  creator: TENANT_ID,
  name: "Batch Token",
  symbol: "BAT",
  decimals: 7,
  initialSupply: "1000",
};

const deployedToken = {
  id: "tok-1",
  address: "CBATCH1",
  creator: TENANT_ID,
  name: "Batch Token",
  symbol: "BAT",
  decimals: 7,
  totalSupply: "1000",
  initialSupply: "1000",
  totalBurned: "0",
  burnCount: 0,
  metadataUri: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const withTenant = (r: request.Test) => r.set("X-Tenant-ID", TENANT_ID);

describe("OpenAPI contract: /api/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents every route registered on the tokens router", () => {
    expect(findUndocumentedRoutes(tokenRoutes, "/api/tokens")).toEqual([]);
  });

  describe("GET /api/tokens/search", () => {
    it("200 — first page with a next cursor", async () => {
      vi.mocked(prisma.token.findMany).mockResolvedValue([
        tokenRow("1", "2026-01-03T00:00:00Z"),
        tokenRow("2", "2026-01-02T00:00:00Z"),
        tokenRow("3", "2026-01-01T00:00:00Z"),
      ] as any);
      vi.mocked(prisma.token.count).mockResolvedValue(3);

      const res = await withTenant(request(app).get("/api/tokens/search?limit=2&q=contract-first"));

      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("200 — cursor page", async () => {
      vi.mocked(prisma.token.findMany).mockResolvedValue([tokenRow("3", "2026-01-01T00:00:00Z")] as any);
      vi.mocked(prisma.token.count).mockResolvedValue(3);
      const cursor = Buffer.from(JSON.stringify({ createdAt: "2026-01-02T00:00:00.000Z", id: "2" })).toString("base64");

      const res = await withTenant(request(app).get(`/api/tokens/search?limit=2&cursor=${cursor}`));

      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("200 — deprecated offset page (served from cache on repeat)", async () => {
      vi.mocked(prisma.token.findMany).mockResolvedValue([tokenRow("2", "2026-01-02T00:00:00Z")] as any);
      vi.mocked(prisma.token.count).mockResolvedValue(3);

      const first = await withTenant(request(app).get("/api/tokens/search?page=2&limit=1&q=contract-offset"));
      expect(first.status).toBe(200);
      expectResponseToMatchSpec(first);

      const cached = await withTenant(request(app).get("/api/tokens/search?page=2&limit=1&q=contract-offset"));
      expect(cached.body.cached).toBe(true);
      expectResponseToMatchSpec(cached);
    });

    it("400 — invalid parameters", async () => {
      const res = await withTenant(request(app).get("/api/tokens/search?sortBy=bogus"));
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("400 — missing tenant context", async () => {
      const res = await request(app).get("/api/tokens/search");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — database failure", async () => {
      vi.mocked(prisma.token.findMany).mockRejectedValue(new Error("db down"));
      vi.mocked(prisma.token.count).mockResolvedValue(0);

      const res = await withTenant(request(app).get("/api/tokens/search?q=contract-500"));
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("POST /api/tokens/batch", () => {
    it("200 — all succeeded", async () => {
      vi.mocked(batchDeployTokens).mockResolvedValue({ succeeded: [deployedToken], failed: [] } as any);
      const res = await withTenant(request(app).post("/api/tokens/batch").send({ tokens: [deployInput] }));
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("207 — mixed results", async () => {
      vi.mocked(batchDeployTokens).mockResolvedValue({
        succeeded: [deployedToken],
        failed: [{ input: deployInput, error: "Skipped due to earlier failure in batch" }],
      } as any);
      const res = await withTenant(
        request(app).post("/api/tokens/batch").send({ tokens: [deployInput, deployInput] })
      );
      expect(res.status).toBe(207);
      expectResponseToMatchSpec(res);
    });

    it("422 — all failed", async () => {
      vi.mocked(batchDeployTokens).mockResolvedValue({
        succeeded: [],
        failed: [{ input: deployInput, error: "Stellar contract call failed" }],
      } as any);
      const res = await withTenant(request(app).post("/api/tokens/batch").send({ tokens: [deployInput] }));
      expect(res.status).toBe(422);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid body", async () => {
      const res = await withTenant(request(app).post("/api/tokens/batch").send({ tokens: [] }));
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — unexpected failure", async () => {
      vi.mocked(batchDeployTokens).mockRejectedValue(new Error("boom"));
      const res = await withTenant(request(app).post("/api/tokens/batch").send({ tokens: [deployInput] }));
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/tokens/deployment-status/{txHash}", () => {
    it("200 — CONFIRMED", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { successful: true, ledger_attr: 123 } });
      vi.mocked(prisma.token.findFirst).mockResolvedValue({ id: "t", address: "C", createdAt: new Date() } as any);

      const res = await withTenant(request(app).get(`/api/tokens/deployment-status/${TX_HASH}`));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CONFIRMED");
      expectResponseToMatchSpec(res);
    });

    it("200 — PENDING (not yet indexed by Horizon)", async () => {
      vi.mocked(axios.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });

      const res = await withTenant(request(app).get(`/api/tokens/deployment-status/${TX_HASH}`));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PENDING");
      expectResponseToMatchSpec(res);
    });

    it("200 — FAILED", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { successful: false, ledger_attr: 9 } });

      const res = await withTenant(request(app).get(`/api/tokens/deployment-status/${TX_HASH}`));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("FAILED");
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid hash", async () => {
      const res = await withTenant(request(app).get("/api/tokens/deployment-status/not-a-hash"));
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — Horizon failure", async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error("horizon down"));
      const res = await withTenant(request(app).get(`/api/tokens/deployment-status/${TX_HASH}`));
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });
});
