/**
 * OpenAPI contract tests — /api/vaults (Issue #2185).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../../services/streamProjectionService", () => ({
  streamProjectionService: {
    getStreamsByCreator: vi.fn(),
    getStreamsByRecipient: vi.fn(),
    getStreamById: vi.fn(),
    getWithdrawalsByStreamId: vi.fn(),
  },
}));

import vaultRoutes from "../../routes/vaults";
import { streamProjectionService } from "../../services/streamProjectionService";
import { expectResponseToMatchSpec, findUndocumentedRoutes } from "../helpers/openapiContract";

const app = express();
app.use(express.json());
app.use("/api/vaults", vaultRoutes);

// Mirrors `buildProjection`: optional fields are `undefined` (omitted in JSON).
const vault = (streamId: number, overrides: Record<string, unknown> = {}) => ({
  id: `stream-${streamId}`,
  streamId,
  creator: "GCREATOR1",
  recipient: "GBENEFICIARY1",
  amount: "5000000",
  metadata: undefined,
  status: "CREATED",
  txHash: `tx${streamId}`,
  createdAt: new Date("2026-03-01T00:00:00Z"),
  claimedAt: undefined,
  cancelledAt: undefined,
  ...overrides,
});

const withdrawal = (streamId: number, type: "CLAIMED" | "CANCELLED", n: number) => ({
  id: `w-${n}`,
  streamId,
  transactionType: type,
  amount: "100",
  recipient: "GBENEFICIARY1",
  txHash: `wtx${n}`,
  timestamp: new Date(`2026-03-0${n}T00:00:00Z`),
});

describe("OpenAPI contract: /api/vaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents every route registered on the vaults router", () => {
    expect(findUndocumentedRoutes(vaultRoutes, "/api/vaults")).toEqual([]);
  });

  describe.each([
    ["creator", "getStreamsByCreator"],
    ["beneficiary", "getStreamsByRecipient"],
  ] as const)("GET /api/vaults/%s/{address}", (segment, method) => {
    it("200 — list", async () => {
      vi.mocked(streamProjectionService[method]).mockResolvedValue([
        vault(1),
        vault(2, { status: "CLAIMED", claimedAt: new Date("2026-03-05T00:00:00Z"), metadata: "{\"memo\":\"x\"}" }),
        vault(3, { status: "CANCELLED", cancelledAt: new Date("2026-03-06T00:00:00Z") }),
      ] as any);
      const res = await request(app).get(`/api/vaults/${segment}/GADDR1?limit=10`);
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid status", async () => {
      const res = await request(app).get(`/api/vaults/${segment}/GADDR1?status=ACTIVE`);
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(streamProjectionService[method]).mockRejectedValue(new Error("db down"));
      const res = await request(app).get(`/api/vaults/${segment}/GADDR1`);
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/vaults/{id}", () => {
    it("200 — found", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(vault(7) as any);
      const res = await request(app).get("/api/vaults/7");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid id", async () => {
      const res = await request(app).get("/api/vaults/abc");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("404 — not found", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(null);
      const res = await request(app).get("/api/vaults/404");
      expect(res.status).toBe(404);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/vaults/7");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/vaults/{id}/withdrawals", () => {
    it("200 — first page with more results", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(vault(7) as any);
      vi.mocked(streamProjectionService.getWithdrawalsByStreamId).mockResolvedValue([
        withdrawal(7, "CLAIMED", 3),
        withdrawal(7, "CLAIMED", 2),
        withdrawal(7, "CANCELLED", 1),
      ] as any);
      const res = await request(app).get("/api/vaults/7/withdrawals?limit=2");
      expect(res.status).toBe(200);
      expect(res.body.data.hasMore).toBe(true);
      expectResponseToMatchSpec(res);
    });

    it("200 — last page", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(vault(7) as any);
      vi.mocked(streamProjectionService.getWithdrawalsByStreamId).mockResolvedValue([
        withdrawal(7, "CLAIMED", 3),
        withdrawal(7, "CLAIMED", 2),
      ] as any);
      const cursor = Buffer.from("1").toString("base64");
      const res = await request(app).get(`/api/vaults/7/withdrawals?limit=5&cursor=${cursor}`);
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid status", async () => {
      const res = await request(app).get("/api/vaults/7/withdrawals?status=PENDING");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("404 — vault not found", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(null);
      const res = await request(app).get("/api/vaults/8/withdrawals");
      expect(res.status).toBe(404);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(streamProjectionService.getStreamById).mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/vaults/7/withdrawals");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });
});
