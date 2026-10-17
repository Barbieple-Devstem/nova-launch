/**
 * OpenAPI contract tests — /api/governance (Issue #2185).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { prismaMock, parserMock } = vi.hoisted(() => ({
  prismaMock: {
    proposal: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    vote: { findMany: vi.fn(), count: vi.fn() },
  },
  parserMock: {
    getProposalAnalytics: vi.fn(),
    getGovernanceStats: vi.fn(),
    parseEvent: vi.fn(),
  },
}));

// governance.ts constructs its own PrismaClient at import time.
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor() {
      return prismaMock;
    }
  },
}));

vi.mock("../../services/governanceEventParser", () => ({
  GovernanceEventParser: class {
    constructor() {
      return parserMock;
    }
  },
}));

import governanceRoutes from "../../routes/governance";
import { expectResponseToMatchSpec, findUndocumentedRoutes } from "../helpers/openapiContract";

const app = express();
app.use(express.json());
app.use("/api/governance", governanceRoutes);

const T0 = new Date("2026-04-01T00:00:00Z");
const T1 = new Date("2026-04-08T00:00:00Z");

const proposalRow = (proposalId: number, overrides: Record<string, unknown> = {}) => ({
  id: `prop-${proposalId}`,
  proposalId,
  tokenId: "token-1",
  proposer: "GPROPOSER1",
  title: `Proposal ${proposalId}`,
  description: null,
  proposalType: "PARAMETER_CHANGE",
  status: "ACTIVE",
  startTime: T0,
  endTime: T1,
  quorum: BigInt(1000),
  threshold: BigInt(500),
  metadata: null,
  txHash: `ptx${proposalId}`,
  createdAt: T0,
  updatedAt: T0,
  executedAt: null,
  cancelledAt: null,
  canceller: null,
  cancelReason: null,
  ...overrides,
});

const fullVote = (n: number) => ({
  id: `vote-${n}`,
  proposalId: "prop-1",
  voter: `GVOTER${n}`,
  support: n % 2 === 0,
  weight: BigInt(100 * n),
  reason: n === 1 ? "Looks good" : null,
  txHash: `vtx${n}`,
  timestamp: T0,
});

const listVote = (n: number) => {
  const { id, voter, support, weight, timestamp } = fullVote(n);
  return { id, voter, support, weight, timestamp };
};

const fullExecution = (gasUsed: bigint | null) => ({
  id: "exec-1",
  proposalId: "prop-1",
  executor: "GEXECUTOR1",
  success: true,
  returnData: null,
  gasUsed,
  txHash: "etx1",
  executedAt: T1,
});

const analytics = {
  proposalId: 1,
  totalVotes: 2,
  votesFor: "200",
  votesAgainst: "100",
  participationRate: 30,
  uniqueVoters: 2,
  status: "ACTIVE",
  timeRemaining: 3600,
};

describe("OpenAPI contract: /api/governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents every route registered on the governance router", () => {
    expect(findUndocumentedRoutes(governanceRoutes, "/api/governance")).toEqual([]);
  });

  describe("GET /api/governance/proposals", () => {
    it("200 — list", async () => {
      prismaMock.proposal.findMany.mockResolvedValue([
        { ...proposalRow(1), votes: [listVote(1), listVote(2)], executions: [] },
        {
          ...proposalRow(2, { status: "EXECUTED", executedAt: T1, description: "Raise fee" }),
          votes: [],
          executions: [{ id: "exec-1", executor: "GEXECUTOR1", success: true, executedAt: T1 }],
        },
      ]);
      prismaMock.proposal.count.mockResolvedValue(2);

      const res = await request(app).get("/api/governance/proposals?limit=10");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — validation error", async () => {
      const res = await request(app).get("/api/governance/proposals?limit=0");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — database failure", async () => {
      prismaMock.proposal.findMany.mockRejectedValue(new Error("db down"));
      prismaMock.proposal.count.mockResolvedValue(0);
      const res = await request(app).get("/api/governance/proposals");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/proposals/{proposalId}", () => {
    it("200 — detail with analytics", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue({
        ...proposalRow(1),
        votes: [fullVote(1), fullVote(2)],
        executions: [fullExecution(BigInt(42)), { ...fullExecution(null), id: "exec-2", txHash: "etx2" }],
      });
      parserMock.getProposalAnalytics.mockResolvedValue(analytics);

      const res = await request(app).get("/api/governance/proposals/1");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid id", async () => {
      const res = await request(app).get("/api/governance/proposals/-1");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("404 — not found", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/governance/proposals/99");
      expect(res.status).toBe(404);
      expectResponseToMatchSpec(res);
    });

    it("500 — database failure", async () => {
      prismaMock.proposal.findUnique.mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/governance/proposals/1");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/proposals/{proposalId}/votes", () => {
    it("200 — votes page", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue(proposalRow(1));
      prismaMock.vote.findMany.mockResolvedValue([fullVote(1), fullVote(2)]);
      prismaMock.vote.count.mockResolvedValue(2);

      const res = await request(app).get("/api/governance/proposals/1/votes?limit=5");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("404 — not found", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/governance/proposals/99/votes");
      expect(res.status).toBe(404);
      expectResponseToMatchSpec(res);
    });

    it("500 — database failure", async () => {
      prismaMock.proposal.findUnique.mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/governance/proposals/1/votes");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/proposals/{proposalId}/execution", () => {
    it("200 — executed", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue({
        ...proposalRow(1, { status: "EXECUTED", executedAt: T1 }),
        executions: [fullExecution(BigInt(7))],
      });
      const res = await request(app).get("/api/governance/proposals/1/execution");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("200 — not yet executed", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue({ ...proposalRow(1, { status: "PASSED" }), executions: [] });
      const res = await request(app).get("/api/governance/proposals/1/execution");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("404 — not found", async () => {
      prismaMock.proposal.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/governance/proposals/99/execution");
      expect(res.status).toBe(404);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/queue", () => {
    it("200 — grouped queue", async () => {
      prismaMock.proposal.findMany.mockResolvedValue([
        proposalRow(3, { status: "QUEUED" }),
        proposalRow(4, { status: "QUEUED", proposalType: "TREASURY_SPEND" }),
      ]);
      const res = await request(app).get("/api/governance/queue");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — invalid proposal type", async () => {
      const res = await request(app).get("/api/governance/queue?proposalType=NOPE");
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });

    it("500 — database failure", async () => {
      prismaMock.proposal.findMany.mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/governance/queue");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/stats", () => {
    it("200 — stats", async () => {
      parserMock.getGovernanceStats.mockResolvedValue({
        totalProposals: 4,
        activeProposals: 1,
        executedProposals: 1,
        totalVotes: 9,
        uniqueVoters: 5,
        averageParticipation: 42.5,
        proposalsByType: { PARAMETER_CHANGE: 3, TREASURY_SPEND: 1 },
        proposalsByStatus: { ACTIVE: 1, EXECUTED: 1, QUEUED: 2 },
      });
      const res = await request(app).get("/api/governance/stats");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("500 — failure", async () => {
      parserMock.getGovernanceStats.mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/governance/stats");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("GET /api/governance/voters/{address}", () => {
    it("200 — voter stats", async () => {
      prismaMock.vote.findMany.mockResolvedValue([
        { ...fullVote(1), proposal: { proposalId: 1, title: "Proposal 1", status: "ACTIVE" } },
        { ...fullVote(2), proposal: { proposalId: 2, title: "Proposal 2", status: "PASSED" } },
      ]);
      prismaMock.proposal.count.mockResolvedValue(4);
      const res = await request(app).get("/api/governance/voters/GVOTER1");
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("500 — failure", async () => {
      prismaMock.vote.findMany.mockRejectedValue(new Error("db down"));
      const res = await request(app).get("/api/governance/voters/GVOTER1");
      expect(res.status).toBe(500);
      expectResponseToMatchSpec(res);
    });
  });

  describe("POST /api/governance/events/ingest", () => {
    it("200 — per-event results", async () => {
      parserMock.parseEvent.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("bad event"));
      const res = await request(app)
        .post("/api/governance/events/ingest")
        .send({ events: [{ type: "prop_create" }, { type: "vote_cast" }] });
      expect(res.status).toBe(200);
      expectResponseToMatchSpec(res);
    });

    it("400 — events not an array", async () => {
      const res = await request(app).post("/api/governance/events/ingest").send({ events: "nope" });
      expect(res.status).toBe(400);
      expectResponseToMatchSpec(res);
    });
  });
});
