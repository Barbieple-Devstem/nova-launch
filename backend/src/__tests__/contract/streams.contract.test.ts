/**
 * OpenAPI contract tests — /api/streams (Issue #2185).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "contract-test-secret";
});

vi.mock("../../services/streamMetadataService", () => ({
  getStreamMetadata: vi.fn(),
  listStreamMetadataByCreator: vi.fn(),
  listStreamMetadataByRecipient: vi.fn(),
  upsertStreamMetadata: vi.fn(),
  StreamMetadataAuthError: class StreamMetadataAuthError extends Error {
    constructor() {
      super("Only the stream's creator may update its metadata");
      this.name = "StreamMetadataAuthError";
    }
  },
}));

import streamRoutes from "../../routes/streams";
import {
  getStreamMetadata,
  listStreamMetadataByCreator,
  listStreamMetadataByRecipient,
  upsertStreamMetadata,
  StreamMetadataAuthError,
} from "../../services/streamMetadataService";
import { expectResponseToMatchSpec, findUndocumentedRoutes } from "../helpers/openapiContract";

const CREATOR = "GCREATOR1";

const app = express();
app.use(express.json());
app.use("/api/streams", streamRoutes);

const metadataRow = (streamId: number, overrides: Record<string, unknown> = {}) => ({
  id: `meta-${streamId}`,
  streamId: BigInt(streamId),
  creator: CREATOR,
  recipient: "GRECIPIENT1",
  title: "Payroll",
  description: null,
  tags: ["salary"],
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-02T00:00:00Z"),
  ...overrides,
});

describe("OpenAPI contract: /api/streams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents every route registered on the streams router", () => {
    expect(findUndocumentedRoutes(streamRoutes, "/api/streams")).toEqual([]);
  });

  describe("GET /api/streams/{streamId}/metadata", () => {
    it("200 — metadata present", async () => {
      vi.mocked(getStreamMetadata).mockResolvedValue(metadataRow(1) as any);
      const res = await request(app).get("/api/streams/1/metadata");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("200 — no metadata (data: null)", async () => {
      vi.mocked(getStreamMetadata).mockResolvedValue(null);
      const res = await request(app).get("/api/streams/2/metadata");
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid stream id", async () => {
      const res = await request(app).get("/api/streams/abc/metadata");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(getStreamMetadata).mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/streams/3/metadata");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("PUT /api/streams/{streamId}/metadata", () => {
    const body = { recipient: "GRECIPIENT1", title: "Payroll", tags: ["salary"] };

    it("200 — upserted", async () => {
      vi.mocked(upsertStreamMetadata).mockResolvedValue(metadataRow(1, { description: "Monthly" }) as any);
      const res = await request(app).put("/api/streams/1/metadata").set("X-Tenant-ID", CREATOR).send(body);
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — missing tenant context", async () => {
      const res = await request(app).put("/api/streams/1/metadata").send(body);
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid body", async () => {
      const res = await request(app)
        .put("/api/streams/1/metadata")
        .set("X-Tenant-ID", CREATOR)
        .send({ title: "missing recipient" });
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("403 — caller is not the creator", async () => {
      vi.mocked(upsertStreamMetadata).mockRejectedValue(new StreamMetadataAuthError());
      const res = await request(app).put("/api/streams/1/metadata").set("X-Tenant-ID", "GOTHER1").send(body);
      expect(res.status).toBe(403);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(upsertStreamMetadata).mockRejectedValue(new Error("db down"));
      const res = await request(app).put("/api/streams/1/metadata").set("X-Tenant-ID", CREATOR).send(body);
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe.each([
    ["creator", listStreamMetadataByCreator],
    ["recipient", listStreamMetadataByRecipient],
  ] as const)("GET /api/streams/%s/{address}", (segment, listFn) => {
    it("200 — list", async () => {
      vi.mocked(listFn).mockResolvedValue([metadataRow(1), metadataRow(2, { title: null, tags: [] })] as any);
      const res = await request(app).get(`/api/streams/${segment}/GADDR1`);
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("500 — service failure", async () => {
      vi.mocked(listFn).mockRejectedValue(new Error("db down"));
      const res = await request(app).get(`/api/streams/${segment}/GADDR1`);
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });
});
