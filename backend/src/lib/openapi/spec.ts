/**
 * OpenAPI 3.0 specification for the Nova Launch backend API.
 * Source of truth for all endpoint documentation.
 */

import type {
  OpenAPIObject,
  ParameterObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from "openapi3-ts/oas30";

// ---------------------------------------------------------------------------
// Reusable schemas
// ---------------------------------------------------------------------------

const schemas = {
  ErrorResponse: {
    type: "object",
    description:
      "Legacy error shape (`error` is a string). Used by routes that predate the `ApiErrorEnvelope` helper, e.g. governance and token search.",
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string" },
      message: { type: "string" },
      details: { description: "Optional validation details (e.g. zod issues)." },
    },
    required: ["success", "error"],
  },

  ApiErrorEnvelope: {
    type: "object",
    description: "Error envelope produced by `errorResponse()` in `utils/response.ts`.",
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "INVALID_INPUT" },
          message: { type: "string" },
          details: { description: "Optional, code-specific details." },
          correlationId: { type: "string" },
        },
        required: ["code", "message"],
      },
      timestamp: { type: "string", format: "date-time" },
      correlationId: { type: "string" },
    },
    required: ["success", "error", "timestamp"],
  },

  TenantError: {
    type: "object",
    description: "Rejection from `tenantMiddleware` (missing or invalid tenant context).",
    properties: { error: { type: "string" } },
    required: ["error"],
  },

  ValidationErrorResponse: {
    type: "object",
    description: "express-validator failure produced by `middleware/validation.ts#validate`.",
    properties: {
      success: { type: "boolean", enum: [false] },
      errors: { type: "array", items: { type: "object", additionalProperties: true } },
    },
    required: ["success", "errors"],
  },

  Pagination: {
    type: "object",
    properties: {
      page: { type: "integer", example: 1, deprecated: true, description: "Offset-based page number. Deprecated — prefer `cursor`/`nextCursor`." },
      limit: { type: "integer", example: 20 },
      total: { type: "integer", example: 100 },
      totalPages: { type: "integer", example: 5, deprecated: true },
      hasNext: { type: "boolean", deprecated: true, description: "Deprecated — prefer `hasMore`." },
      hasPrev: { type: "boolean", deprecated: true },
      nextCursor: { type: "string", nullable: true, description: "Opaque cursor for the next page; null when there are no more results." },
      hasMore: { type: "boolean", description: "Whether another page is available via `nextCursor`." },
    },
    required: ["page", "limit", "total", "totalPages", "hasNext", "hasPrev", "nextCursor", "hasMore"],
  },

  TokenRecord: {
    type: "object",
    properties: {
      id: { type: "string" },
      address: { type: "string" },
      creator: { type: "string" },
      name: { type: "string" },
      symbol: { type: "string" },
      decimals: { type: "integer" },
      totalSupply: { type: "string", description: "BigInt as string" },
      initialSupply: { type: "string", description: "BigInt as string" },
      totalBurned: { type: "string", description: "BigInt as string" },
      burnCount: { type: "integer" },
      metadataUri: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id", "address", "creator", "name", "symbol", "decimals", "totalSupply",
      "initialSupply", "totalBurned", "burnCount", "metadataUri", "createdAt", "updatedAt",
    ],
  },

  TokenSearchFilters: {
    type: "object",
    description: "Echo of the filters applied to the search (undefined filters are omitted).",
    properties: {
      q: { type: "string" },
      creator: { type: "string" },
      startDate: { type: "string" },
      endDate: { type: "string" },
      minSupply: { type: "string" },
      maxSupply: { type: "string" },
      hasBurns: { type: "string", enum: ["true", "false"] },
      sortBy: { type: "string", enum: ["created", "burned", "supply", "name"] },
      sortOrder: { type: "string", enum: ["asc", "desc"] },
      cursor: { type: "string" },
    },
    required: ["sortBy", "sortOrder"],
  },

  TokenSearchResponse: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      data: { type: "array", items: { $ref: "#/components/schemas/TokenRecord" } },
      pagination: { $ref: "#/components/schemas/Pagination" },
      filters: { $ref: "#/components/schemas/TokenSearchFilters" },
      cached: { type: "boolean", description: "Present (true) when served from the in-memory cache." },
    },
    required: ["success", "data", "pagination", "filters"],
  },

  TokenDeployInput: {
    type: "object",
    properties: {
      creator: { type: "string", maxLength: 64 },
      name: { type: "string", maxLength: 100 },
      symbol: { type: "string", maxLength: 12, pattern: "^[A-Z0-9]+$" },
      decimals: { type: "integer", minimum: 0, maximum: 18 },
      initialSupply: { type: "string", pattern: "^\\d+$" },
      metadataUri: { type: "string", format: "uri" },
    },
    required: ["creator", "name", "symbol", "decimals", "initialSupply"],
  },

  DeployedToken: {
    type: "object",
    properties: {
      id: { type: "string" },
      address: { type: "string" },
      creator: { type: "string" },
      name: { type: "string" },
      symbol: { type: "string" },
      decimals: { type: "integer" },
      totalSupply: { type: "string" },
      initialSupply: { type: "string" },
      totalBurned: { type: "string" },
      burnCount: { type: "integer" },
      metadataUri: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "id", "address", "creator", "name", "symbol", "decimals", "totalSupply",
      "initialSupply", "totalBurned", "burnCount", "metadataUri", "createdAt", "updatedAt",
    ],
  },

  FailedTokenDeploy: {
    type: "object",
    properties: {
      input: { $ref: "#/components/schemas/TokenDeployInput" },
      error: { type: "string" },
    },
    required: ["input", "error"],
  },

  BatchDeployResult: {
    type: "object",
    properties: {
      succeeded: { type: "array", items: { $ref: "#/components/schemas/DeployedToken" } },
      failed: { type: "array", items: { $ref: "#/components/schemas/FailedTokenDeploy" } },
    },
    required: ["succeeded", "failed"],
  },

  DeploymentStatus: {
    type: "object",
    properties: {
      txHash: { type: "string" },
      status: { type: "string", enum: ["PENDING", "CONFIRMED", "FAILED"] },
      reason: { type: "string" },
      ledger: { type: "integer" },
    },
    required: ["txHash", "status"],
  },

  CampaignRecord: {
    type: "object",
    properties: {
      id: { type: "string" },
      campaignId: { type: "integer" },
      tokenId: { type: "string" },
      creator: { type: "string" },
      type: { type: "string" },
      status: { type: "string" },
      targetAmount: { type: "string" },
      currentAmount: { type: "string" },
      executionCount: { type: "integer" },
      progress: { type: "number" },
      startTime: { type: "string", format: "date-time" },
      endTime: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  ProposalRecord: {
    type: "object",
    properties: {
      id: { type: "string" },
      proposalId: { type: "integer" },
      tokenId: { type: "string" },
      proposer: { type: "string" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: ["ACTIVE", "PASSED", "REJECTED", "QUEUED", "EXECUTED", "CANCELLED", "EXPIRED"],
      },
      proposalType: {
        type: "string",
        enum: ["PARAMETER_CHANGE", "ADMIN_TRANSFER", "TREASURY_SPEND", "CONTRACT_UPGRADE", "CUSTOM"],
      },
      quorum: { type: "string", description: "BigInt as string" },
      threshold: { type: "string", description: "BigInt as string" },
      metadata: { type: "string", nullable: true },
      txHash: { type: "string" },
      startTime: { type: "string", format: "date-time" },
      endTime: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      executedAt: { type: "string", format: "date-time", nullable: true },
      cancelledAt: { type: "string", format: "date-time", nullable: true },
      canceller: { type: "string", nullable: true },
      cancelReason: { type: "string", nullable: true },
      votes: { type: "array", items: { $ref: "#/components/schemas/GovernanceVoteRecord" } },
      executions: { type: "array", items: { $ref: "#/components/schemas/ProposalExecutionRecord" } },
    },
    required: [
      "id", "proposalId", "tokenId", "proposer", "title", "status", "proposalType",
      "quorum", "threshold", "startTime", "endTime", "createdAt", "updatedAt", "votes", "executions",
    ],
  },

  GovernanceVoteRecord: {
    type: "object",
    description: "List endpoints return the core fields; detail/vote endpoints also include proposalId, reason and txHash.",
    properties: {
      id: { type: "string" },
      proposalId: { type: "string", description: "Internal proposal UUID" },
      voter: { type: "string" },
      support: { type: "boolean" },
      weight: { type: "string", description: "BigInt as string" },
      reason: { type: "string", nullable: true },
      txHash: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
    },
    required: ["id", "voter", "support", "weight", "timestamp"],
  },

  ProposalExecutionRecord: {
    type: "object",
    properties: {
      id: { type: "string" },
      proposalId: { type: "string", description: "Internal proposal UUID" },
      executor: { type: "string" },
      success: { type: "boolean" },
      returnData: { type: "string", nullable: true },
      gasUsed: { type: "string", description: "BigInt as string; omitted when unknown" },
      txHash: { type: "string" },
      executedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "executor", "success", "executedAt"],
  },

  ProposalAnalytics: {
    type: "object",
    properties: {
      proposalId: { type: "integer" },
      totalVotes: { type: "integer" },
      votesFor: { type: "string" },
      votesAgainst: { type: "string" },
      participationRate: { type: "number" },
      uniqueVoters: { type: "integer" },
      status: { type: "string" },
      timeRemaining: { type: "integer", description: "Seconds until voting ends; omitted once ended" },
    },
    required: ["proposalId", "totalVotes", "votesFor", "votesAgainst", "participationRate", "uniqueVoters", "status"],
  },

  GovernanceStats: {
    type: "object",
    properties: {
      totalProposals: { type: "integer" },
      activeProposals: { type: "integer" },
      executedProposals: { type: "integer" },
      totalVotes: { type: "integer" },
      uniqueVoters: { type: "integer" },
      averageParticipation: { type: "number" },
      proposalsByType: { type: "object", additionalProperties: { type: "integer" } },
      proposalsByStatus: { type: "object", additionalProperties: { type: "integer" } },
    },
    required: [
      "totalProposals", "activeProposals", "executedProposals", "totalVotes",
      "uniqueVoters", "averageParticipation", "proposalsByType", "proposalsByStatus",
    ],
  },

  VoterStats: {
    type: "object",
    properties: {
      address: { type: "string" },
      totalVotes: { type: "integer" },
      votingPower: { type: "string" },
      participationRate: { type: "number" },
      proposalsVoted: { type: "array", items: { type: "integer" } },
      recentVotes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            proposalId: { type: "integer" },
            proposalTitle: { type: "string" },
            support: { type: "boolean" },
            weight: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
          required: ["proposalId", "proposalTitle", "support", "weight", "timestamp"],
        },
      },
    },
    required: ["address", "totalVotes", "votingPower", "participationRate", "proposalsVoted", "recentVotes"],
  },

  QueuedProposal: {
    type: "object",
    properties: {
      proposalId: { type: "integer" },
      tokenId: { type: "string" },
      title: { type: "string" },
      proposalType: { type: "string" },
      status: { type: "string", enum: ["QUEUED"] },
      position: { type: "integer", description: "0-based position within its proposal-type queue" },
      queuedAt: { type: "string", format: "date-time" },
    },
    required: ["proposalId", "tokenId", "title", "proposalType", "status", "position", "queuedAt"],
  },

  StreamRecord: {
    type: "object",
    description: "Off-chain payment-stream metadata (`PaymentStreamMetadata`) served by `/api/streams`.",
    properties: {
      id: { type: "string" },
      streamId: { type: "string", description: "On-chain u64 stream id as string" },
      creator: { type: "string" },
      recipient: { type: "string" },
      title: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      tags: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "streamId", "creator", "recipient", "title", "description", "tags", "createdAt", "updatedAt"],
  },

  StreamMetadataInput: {
    type: "object",
    properties: {
      recipient: { type: "string", minLength: 1 },
      title: { type: "string", maxLength: 200 },
      description: { type: "string", maxLength: 2000 },
      tags: { type: "array", maxItems: 20, items: { type: "string", maxLength: 50 } },
    },
    required: ["recipient"],
  },

  VaultRecord: {
    type: "object",
    description: "On-chain stream-vault projection (`Stream` table) served by `/api/vaults`.",
    properties: {
      id: { type: "string" },
      streamId: { type: "integer" },
      creator: { type: "string" },
      recipient: { type: "string", description: "Beneficiary address" },
      amount: { type: "string", description: "BigInt as string" },
      metadata: { type: "string" },
      status: { type: "string", enum: ["CREATED", "CLAIMED", "CANCELLED"] },
      txHash: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      claimedAt: { type: "string", format: "date-time" },
      cancelledAt: { type: "string", format: "date-time" },
    },
    required: ["id", "streamId", "creator", "recipient", "amount", "status", "txHash", "createdAt"],
  },

  VaultWithdrawal: {
    type: "object",
    properties: {
      id: { type: "string" },
      vaultId: { type: "integer" },
      transactionType: { type: "string", enum: ["CLAIMED", "CANCELLED"] },
      amount: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
      txHash: { type: "string" },
      recipient: { type: "string" },
    },
    required: ["id", "vaultId", "transactionType", "amount", "timestamp", "txHash", "recipient"],
  },

  VaultWithdrawalPage: {
    type: "object",
    properties: {
      withdrawals: { type: "array", items: { $ref: "#/components/schemas/VaultWithdrawal" } },
      nextCursor: { type: "string" },
      prevCursor: { type: "string" },
      hasMore: { type: "boolean" },
      totalCount: { type: "integer" },
    },
    required: ["withdrawals", "hasMore", "totalCount"],
  },

  WebhookSubscription: {
    type: "object",
    properties: {
      id: { type: "string" },
      url: { type: "string", format: "uri" },
      tokenAddress: { type: "string", nullable: true },
      events: {
        type: "array",
        items: {
          type: "string",
          enum: ["token.burn.self", "token.burn.admin", "token.created", "token.metadata.updated"],
        },
      },
      secret: { type: "string" },
      active: { type: "boolean" },
      createdBy: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      lastTriggered: { type: "string", format: "date-time", nullable: true },
    },
  },

  HealthStatus: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
      uptime: { type: "number" },
      timestamp: { type: "string", format: "date-time" },
    },
  },

  DeadLetterEntry: {
    type: "object",
    description:
      "A webhook delivery that exhausted all retry attempts and was routed to the dead-letter store.",
    properties: {
      id: { type: "string" },
      subscriptionId: { type: "string" },
      event: {
        type: "string",
        enum: ["token.burn.self", "token.burn.admin", "token.created", "token.metadata.updated"],
      },
      payload: { type: "string", description: "JSON-stringified original webhook payload" },
      statusCode: { type: "integer", nullable: true },
      lastError: { type: "string", nullable: true },
      attemptCount: { type: "integer", description: "Attempts made before exhaustion (pre-retry)" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      resolvedAt: { type: "string", format: "date-time", nullable: true },
      resolution: { type: "string", enum: ["retried", "skipped", "archived"], nullable: true },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Reusable parameters
// ---------------------------------------------------------------------------

const parameters = {
  PageParam: {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  LimitParam: {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
  PeriodParam: {
    name: "period",
    in: "query",
    schema: { type: "string", enum: ["24h", "7d", "30d", "all"], default: "7d" },
  },
  AddressParam: {
    name: "address",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "Stellar wallet address",
  },
} as const;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const ref = (name: string): ReferenceObject => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: SchemaObject | ReferenceObject) => ({ "application/json": { schema } });

/** `successResponse(data)` envelope from `utils/response.ts`. */
const envelope = (data: SchemaObject | ReferenceObject): SchemaObject => ({
  type: "object",
  properties: {
    success: { type: "boolean", enum: [true] },
    data,
    timestamp: { type: "string", format: "date-time" },
    correlationId: { type: "string" },
  },
  required: ["success", "data", "timestamp"],
});

/** Hand-rolled `{ success, data }` body used by governance routes. */
const legacyOk = (data: SchemaObject | ReferenceObject): SchemaObject => ({
  type: "object",
  properties: { success: { type: "boolean", enum: [true] }, data },
  required: ["success", "data"],
});

const apiError = (description: string): ResponseObject => ({ description, content: json(ref("ApiErrorEnvelope")) });
const legacyError = (description: string): ResponseObject => ({ description, content: json(ref("ErrorResponse")) });
/** Error responses on tenant-scoped routes may also come from `tenantMiddleware`. */
const orTenantError = (description: string, name: "ErrorResponse" | "ApiErrorEnvelope"): ResponseObject => ({
  description,
  content: json({ anyOf: [ref(name), ref("TenantError")] }),
});
const validationError: ResponseObject = { description: "Validation error", content: json(ref("ValidationErrorResponse")) };

const proposalIdParam: ParameterObject = { name: "proposalId", in: "path", required: true, schema: { type: "integer", minimum: 0 } };

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const paths: OpenAPIObject["paths"] = {
  // Health
  "/health/live": {
    get: {
      tags: ["Health"],
      summary: "Liveness probe",
      description: "Returns 200 as long as the process is running.",
      responses: {
        "200": {
          description: "Process is alive",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthStatus" } } },
        },
      },
    },
  },
  "/health/ready": {
    get: {
      tags: ["Health"],
      summary: "Readiness probe",
      description: "Checks all dependency connections.",
      responses: {
        "200": { description: "All dependencies healthy" },
        "207": { description: "Degraded — some dependencies unreachable" },
        "503": { description: "Unhealthy" },
      },
    },
  },

  // Version
  "/api/version": {
    get: {
      tags: ["Version"],
      summary: "Backend version info",
      responses: {
        "200": {
          description: "Version details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  backendVersion: { type: "string" },
                  contractId: { type: "string" },
                  network: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },

  // Stats
  "/api/stats": {
    get: {
      tags: ["Stats"],
      summary: "Platform statistics",
      responses: {
        "200": {
          description: "Platform stats",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  totalTokens: { type: "integer" },
                  totalUsers: { type: "integer" },
                  totalBurned: { type: "string" },
                  uptime: { type: "string" },
                  lastUpdated: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
  },

  // Tokens
  "/api/tokens/search": {
    get: {
      tags: ["Tokens"],
      summary: "Search and filter tokens",
      description: "Requires tenant context (`X-Tenant-ID` header or JWT tenant claim); results are always scoped to the tenant.",
      parameters: [
        { name: "q", in: "query", schema: { type: "string" }, description: "Search by name or symbol" },
        { name: "creator", in: "query", schema: { type: "string" } },
        { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
        { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
        { name: "minSupply", in: "query", schema: { type: "string" } },
        { name: "maxSupply", in: "query", schema: { type: "string" } },
        { name: "hasBurns", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        { name: "sortBy", in: "query", schema: { type: "string", enum: ["created", "burned", "supply", "name"], default: "created" } },
        { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        { name: "cursor", in: "query", schema: { type: "string" }, description: "Opaque keyset cursor from a previous response's `pagination.nextCursor`. Only supported when sortBy=created; takes precedence over `page`." },
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, deprecated: true, description: "Offset-based page number. Deprecated in favor of `cursor` — inconsistent results may occur when new tokens are deployed between page fetches." },
        { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
      ],
      responses: {
        "200": {
          description: "Token search results. Prefer cursor pagination: pass `pagination.nextCursor` back as `cursor` until it is null. Requests that send `page` (without `cursor`) receive deprecation headers.",
          headers: {
            Deprecation: { description: "`true` when the deprecated `page` parameter was used.", schema: { type: "string" } },
            Sunset: { description: "Date after which offset (`page`) pagination may be removed.", schema: { type: "string" } },
            Link: { description: "Link to the successor (`cursor`) documentation, rel=\"deprecation\".", schema: { type: "string" } },
            Warning: { description: "299 warning describing the deprecation.", schema: { type: "string" } },
          },
          content: json(ref("TokenSearchResponse")),
        },
        "400": orTenantError("Invalid parameters, malformed `cursor`, `cursor` combined with a sortBy other than `created`, or missing tenant context", "ErrorResponse"),
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/tokens/batch": {
    post: {
      tags: ["Tokens"],
      summary: "Deploy up to 10 tokens atomically",
      requestBody: {
        required: true,
        content: json({
          type: "object",
          properties: { tokens: { type: "array", minItems: 1, maxItems: 10, items: ref("TokenDeployInput") } },
          required: ["tokens"],
        }),
      },
      responses: {
        "200": { description: "All tokens deployed", content: json(envelope(ref("BatchDeployResult"))) },
        "207": { description: "Mixed results", content: json(envelope(ref("BatchDeployResult"))) },
        "400": orTenantError("Invalid request body or missing tenant context", "ApiErrorEnvelope"),
        "422": { description: "All tokens failed", content: json(envelope(ref("BatchDeployResult"))) },
        "500": apiError("Batch deployment failed"),
      },
    },
  },
  "/api/tokens/deployment-status/{txHash}": {
    get: {
      tags: ["Tokens"],
      summary: "Stellar finality + backend indexing status of a deployment",
      parameters: [
        { name: "txHash", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{64}$" } },
        { name: "network", in: "query", schema: { type: "string", enum: ["testnet", "mainnet"], default: "testnet" } },
      ],
      responses: {
        "200": { description: "Deployment status", content: json(ref("DeploymentStatus")) },
        "400": orTenantError("Invalid transaction hash, network, or missing tenant context", "ErrorResponse"),
        "500": legacyError("Failed to fetch deployment status"),
      },
    },
  },

  // Leaderboard
  "/api/leaderboard/most-burned": {
    get: {
      tags: ["Leaderboard"],
      summary: "Tokens with highest burn volume",
      parameters: [
        { $ref: "#/components/parameters/PeriodParam" },
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
      ],
      responses: {
        "200": { description: "Leaderboard results" },
        "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
    },
  },
  "/api/leaderboard/most-active": {
    get: {
      tags: ["Leaderboard"],
      summary: "Tokens with most burn transactions",
      parameters: [
        { $ref: "#/components/parameters/PeriodParam" },
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
      ],
      responses: { "200": { description: "Leaderboard results" } },
    },
  },
  "/api/leaderboard/newest": {
    get: {
      tags: ["Leaderboard"],
      summary: "Recently created tokens",
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
      ],
      responses: { "200": { description: "Leaderboard results" } },
    },
  },
  "/api/leaderboard/largest-supply": {
    get: {
      tags: ["Leaderboard"],
      summary: "Tokens with highest total supply",
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
      ],
      responses: { "200": { description: "Leaderboard results" } },
    },
  },
  "/api/leaderboard/most-burners": {
    get: {
      tags: ["Leaderboard"],
      summary: "Tokens with most unique burners",
      parameters: [
        { $ref: "#/components/parameters/PeriodParam" },
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
      ],
      responses: { "200": { description: "Leaderboard results" } },
    },
  },

  // Governance
  "/api/governance/proposals": {
    get: {
      tags: ["Governance"],
      summary: "List governance proposals",
      parameters: [
        { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "PASSED", "REJECTED", "QUEUED", "EXECUTED", "CANCELLED", "EXPIRED"] } },
        { name: "proposalType", in: "query", schema: { type: "string", enum: ["PARAMETER_CHANGE", "ADMIN_TRANSFER", "TREASURY_SPEND", "CONTRACT_UPGRADE", "CUSTOM"] } },
        { name: "tokenId", in: "query", schema: { type: "string" } },
        { name: "proposer", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        { name: "sortBy", in: "query", schema: { type: "string", enum: ["createdAt", "startTime", "endTime"], default: "createdAt" } },
        { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
      ],
      responses: {
        "200": {
          description: "List of proposals",
          content: json(legacyOk({
            type: "object",
            properties: {
              proposals: { type: "array", items: ref("ProposalRecord") },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
            required: ["proposals", "total", "limit", "offset"],
          })),
        },
        "400": validationError,
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/proposals/{proposalId}": {
    get: {
      tags: ["Governance"],
      summary: "Get proposal by on-chain ID, with analytics",
      parameters: [proposalIdParam],
      responses: {
        "200": {
          description: "Proposal detail",
          content: json(legacyOk({
            type: "object",
            properties: { proposal: ref("ProposalRecord"), analytics: ref("ProposalAnalytics") },
            required: ["proposal", "analytics"],
          })),
        },
        "400": validationError,
        "404": legacyError("Proposal not found"),
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/proposals/{proposalId}/votes": {
    get: {
      tags: ["Governance"],
      summary: "Get votes for a proposal",
      parameters: [
        proposalIdParam,
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
      ],
      responses: {
        "200": {
          description: "Votes list",
          content: json(legacyOk({
            type: "object",
            properties: {
              votes: { type: "array", items: ref("GovernanceVoteRecord") },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
            required: ["votes", "total", "limit", "offset"],
          })),
        },
        "400": validationError,
        "404": legacyError("Proposal not found"),
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/proposals/{proposalId}/execution": {
    get: {
      tags: ["Governance"],
      summary: "Proposal execution status",
      parameters: [proposalIdParam],
      responses: {
        "200": {
          description: "Execution status",
          content: json(legacyOk({
            type: "object",
            properties: {
              proposalId: { type: "integer" },
              status: { type: "string" },
              executedAt: { type: "string", format: "date-time", nullable: true },
              executions: { type: "array", items: ref("ProposalExecutionRecord") },
              isExecuted: { type: "boolean" },
              canExecute: { type: "boolean" },
            },
            required: ["proposalId", "status", "executedAt", "executions", "isExecuted", "canExecute"],
          })),
        },
        "400": validationError,
        "404": legacyError("Proposal not found"),
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/queue": {
    get: {
      tags: ["Governance"],
      summary: "Queued proposals grouped by type (FIFO)",
      parameters: [
        { name: "proposalType", in: "query", schema: { type: "string", enum: ["PARAMETER_CHANGE", "ADMIN_TRANSFER", "TREASURY_SPEND", "CONTRACT_UPGRADE", "CUSTOM"] } },
      ],
      responses: {
        "200": {
          description: "Queue snapshot",
          content: json(legacyOk({
            type: "object",
            properties: {
              total: { type: "integer" },
              queues: { type: "object", additionalProperties: { type: "array", items: ref("QueuedProposal") } },
            },
            required: ["total", "queues"],
          })),
        },
        "400": validationError,
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/stats": {
    get: {
      tags: ["Governance"],
      summary: "Aggregate governance statistics",
      responses: {
        "200": { description: "Governance stats", content: json(legacyOk(ref("GovernanceStats"))) },
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/voters/{address}": {
    get: {
      tags: ["Governance"],
      summary: "Voting history and stats for an address",
      parameters: [{ $ref: "#/components/parameters/AddressParam" }],
      responses: {
        "200": { description: "Voter stats", content: json(legacyOk(ref("VoterStats"))) },
        "500": legacyError("Server error"),
      },
    },
  },
  "/api/governance/events/ingest": {
    post: {
      tags: ["Governance"],
      summary: "Ingest raw governance contract events",
      requestBody: {
        required: true,
        content: json({ type: "object", properties: { events: { type: "array", items: { type: "object" } } }, required: ["events"] }),
      },
      responses: {
        "200": {
          description: "Per-event ingestion results",
          content: json(legacyOk({
            type: "object",
            properties: {
              processed: { type: "integer" },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: { success: { type: "boolean" }, event: { type: "string" }, error: { type: "string" } },
                  required: ["success"],
                },
              },
            },
            required: ["processed", "results"],
          })),
        },
        "400": legacyError("`events` is not an array"),
        "500": legacyError("Server error"),
      },
    },
  },

  // Campaigns
  "/api/campaigns/stats/{tokenId}": {
    get: {
      tags: ["Campaigns"],
      summary: "Campaign statistics for a token (or global)",
      parameters: [{ name: "tokenId", in: "path", required: false, schema: { type: "string" } }],
      responses: { "200": { description: "Campaign stats" } },
    },
  },
  "/api/campaigns/token/{tokenId}": {
    get: {
      tags: ["Campaigns"],
      summary: "Campaigns for a token",
      parameters: [{ name: "tokenId", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Campaign list",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/CampaignRecord" } } } },
        },
      },
    },
  },
  "/api/campaigns/creator/{creator}": {
    get: {
      tags: ["Campaigns"],
      summary: "Campaigns by creator address",
      parameters: [{ name: "creator", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Campaign list" } },
    },
  },
  "/api/campaigns/{campaignId}": {
    get: {
      tags: ["Campaigns"],
      summary: "Get campaign by ID",
      parameters: [{ name: "campaignId", in: "path", required: true, schema: { type: "integer" } }],
      responses: {
        "200": { description: "Campaign detail" },
        "404": { description: "Not found" },
      },
    },
  },
  "/api/campaigns/{campaignId}/executions": {
    get: {
      tags: ["Campaigns"],
      summary: "Execution history for a campaign",
      parameters: [
        { name: "campaignId", in: "path", required: true, schema: { type: "integer" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: { "200": { description: "Execution history" } },
    },
  },

  // Streams (off-chain payment-stream metadata)
  "/api/streams/{streamId}/metadata": {
    get: {
      tags: ["Streams"],
      summary: "Off-chain metadata for a stream",
      parameters: [{ name: "streamId", in: "path", required: true, schema: { type: "string", pattern: "^\\d+$" } }],
      responses: {
        "200": {
          description: "Stream metadata, or `data: null` when none has been set",
          content: json(envelope({ allOf: [ref("StreamRecord")], nullable: true })),
        },
        "400": apiError("Invalid stream ID"),
        "500": apiError("Server error"),
      },
    },
    put: {
      tags: ["Streams"],
      summary: "Create or update stream metadata (creator only)",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "streamId", in: "path", required: true, schema: { type: "string", pattern: "^\\d+$" } }],
      requestBody: { required: true, content: json(ref("StreamMetadataInput")) },
      responses: {
        "200": { description: "Updated metadata", content: json(envelope(ref("StreamRecord"))) },
        "400": orTenantError("Invalid stream ID or body, or missing/invalid tenant context", "ApiErrorEnvelope"),
        "401": apiError("Authentication required"),
        "403": apiError("Caller is not the stream creator"),
        "500": apiError("Server error"),
      },
    },
  },
  "/api/streams/creator/{address}": {
    get: {
      tags: ["Streams"],
      summary: "Stream metadata for streams created by address",
      parameters: [{ $ref: "#/components/parameters/AddressParam" }],
      responses: {
        "200": { description: "Stream metadata list", content: json(envelope({ type: "array", items: ref("StreamRecord") })) },
        "500": apiError("Server error"),
      },
    },
  },
  "/api/streams/recipient/{address}": {
    get: {
      tags: ["Streams"],
      summary: "Stream metadata for streams where address is the recipient",
      parameters: [{ $ref: "#/components/parameters/AddressParam" }],
      responses: {
        "200": { description: "Stream metadata list", content: json(envelope({ type: "array", items: ref("StreamRecord") })) },
        "500": apiError("Server error"),
      },
    },
  },

  // Vaults (on-chain stream projection)
  "/api/vaults/creator/{address}": {
    get: {
      tags: ["Vaults"],
      summary: "Vaults created by address",
      parameters: [
        { $ref: "#/components/parameters/AddressParam" },
        { name: "status", in: "query", schema: { type: "string", enum: ["CREATED", "CLAIMED", "CANCELLED"] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": { description: "Vault list", content: json(envelope({ type: "array", items: ref("VaultRecord") })) },
        "400": apiError("Invalid status"),
        "500": apiError("Server error"),
      },
    },
  },
  "/api/vaults/beneficiary/{address}": {
    get: {
      tags: ["Vaults"],
      summary: "Vaults where address is the beneficiary",
      parameters: [
        { $ref: "#/components/parameters/AddressParam" },
        { name: "status", in: "query", schema: { type: "string", enum: ["CREATED", "CLAIMED", "CANCELLED"] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": { description: "Vault list", content: json(envelope({ type: "array", items: ref("VaultRecord") })) },
        "400": apiError("Invalid status"),
        "500": apiError("Server error"),
      },
    },
  },
  "/api/vaults/{id}": {
    get: {
      tags: ["Vaults"],
      summary: "Get vault by on-chain stream ID",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: {
        "200": { description: "Vault detail", content: json(envelope(ref("VaultRecord"))) },
        "400": apiError("Invalid vault ID"),
        "404": apiError("Vault not found"),
        "500": apiError("Server error"),
      },
    },
  },
  "/api/vaults/{id}/withdrawals": {
    get: {
      tags: ["Vaults"],
      summary: "Withdrawal history for a vault",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 50 } },
        { name: "cursor", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["CLAIMED", "CANCELLED"] } },
      ],
      responses: {
        "200": { description: "Withdrawal page", content: json(envelope(ref("VaultWithdrawalPage"))) },
        "400": apiError("Invalid vault ID or status"),
        "404": apiError("Vault not found"),
        "500": apiError("Server error"),
      },
    },
  },

  // Webhooks
  "/api/webhooks/subscribe": {
    post: {
      tags: ["Webhooks"],
      summary: "Create a webhook subscription",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["url", "events", "createdBy"],
              properties: {
                url: { type: "string", format: "uri" },
                tokenAddress: { type: "string", nullable: true },
                events: {
                  type: "array",
                  items: { type: "string", enum: ["token.burn.self", "token.burn.admin", "token.created", "token.metadata.updated"] },
                },
                createdBy: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Subscription created",
          content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookSubscription" } } },
        },
        "400": { description: "Invalid input" },
      },
    },
  },
  "/api/webhooks/unsubscribe/{id}": {
    delete: {
      tags: ["Webhooks"],
      summary: "Delete a webhook subscription",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": { description: "Deleted successfully" },
        "404": { description: "Not found" },
      },
    },
  },
  "/api/webhooks/subscriptions": {
    get: {
      tags: ["Webhooks"],
      summary: "List webhook subscriptions",
      parameters: [{ name: "createdBy", in: "query", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Subscription list" } },
    },
  },
  "/api/webhooks/{id}/toggle": {
    patch: {
      tags: ["Webhooks"],
      summary: "Toggle webhook active state",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Toggled" } },
    },
  },
  "/api/webhooks/{id}/logs": {
    get: {
      tags: ["Webhooks"],
      summary: "Delivery logs for a webhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Delivery logs" } },
    },
  },
  "/api/webhooks/{id}/test": {
    post: {
      tags: ["Webhooks"],
      summary: "Send a test event to a webhook",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Test result" } },
    },
  },

  // Webhook dead-letter queue (admin-only)
  "/api/webhooks/dead-letter": {
    get: {
      tags: ["Webhooks"],
      summary: "List webhook dead-letter entries (admin only)",
      description:
        "Paginated list of failed webhook deliveries that exhausted all retries, across all subscriptions. " +
        "Supports filtering by tenant (the subscription owner's `createdBy` address — the closest existing field " +
        "to a tenant identifier in this codebase) and by failure reason (substring match on the last error message).",
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
        { name: "tenant", in: "query", schema: { type: "string" }, description: "Filter by subscription owner (created_by) address" },
        { name: "failureReason", in: "query", schema: { type: "string" }, description: "Substring match against the last recorded error message" },
        { name: "resolved", in: "query", schema: { type: "string", enum: ["true", "false"] }, description: "Filter by resolution status" },
      ],
      responses: {
        "200": {
          description: "Paginated dead-letter entries",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: {
                    type: "object",
                    properties: {
                      entries: { type: "array", items: { $ref: "#/components/schemas/DeadLetterEntry" } },
                      pagination: { $ref: "#/components/schemas/Pagination" },
                    },
                  },
                },
              },
            },
          },
        },
        "400": { description: "Invalid query parameters", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        "401": { description: "Authentication required" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/webhooks/dead-letter/{id}/retry": {
    post: {
      tags: ["Webhooks"],
      summary: "Retry a dead-lettered delivery (admin only)",
      description:
        "Re-enqueues the original payload for delivery with a fresh attempt counter (does not resume the " +
        "exhausted counter that originally routed the entry to the dead-letter queue). Writes an audit log entry.",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": { description: "Entry re-enqueued for delivery" },
        "401": { description: "Authentication required" },
        "403": { description: "Admin access required" },
        "404": { description: "Dead-letter entry or associated subscription not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        "409": { description: "Entry already resolved", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
    },
  },
  "/api/webhooks/dead-letter/{id}": {
    delete: {
      tags: ["Webhooks"],
      summary: "Discard a dead-lettered delivery (admin only)",
      description: "Marks the dead-letter entry as archived without retrying delivery. Writes an audit log entry.",
      security: [{ BearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": { description: "Entry discarded" },
        "401": { description: "Authentication required" },
        "403": { description: "Admin access required" },
        "404": { description: "Dead-letter entry not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        "409": { description: "Entry already resolved", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Full spec
// ---------------------------------------------------------------------------

export const openApiSpec: OpenAPIObject = {
  openapi: "3.0.3",
  info: {
    title: "Nova Launch API",
    version: "1.0.0",
    description: "REST API for the Nova Launch Stellar token deployment platform.",
    contact: { name: "Nova Launch", url: "https://github.com/Emmyt24/Nova-launch" },
    license: { name: "MIT" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development" },
    { url: "https://api.nova-launch.app", description: "Production" },
  ],
  tags: [
    { name: "Health", description: "Liveness and readiness probes" },
    { name: "Version", description: "Backend version info" },
    { name: "Stats", description: "Platform statistics" },
    { name: "Tokens", description: "Token search and discovery" },
    { name: "Leaderboard", description: "Token leaderboards" },
    { name: "Governance", description: "On-chain governance proposals" },
    { name: "Campaigns", description: "Token campaigns" },
    { name: "Streams", description: "Token streams" },
    { name: "Vaults", description: "Token vaults" },
    { name: "Webhooks", description: "Webhook subscriptions and delivery" },
  ],
  paths,
  components: {
    schemas: schemas as unknown as OpenAPIObject["components"]["schemas"],
    parameters: parameters as unknown as OpenAPIObject["components"]["parameters"],
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Admin JWT issued for users with role 'admin' or 'super_admin'.",
      },
    },
  },
};

export default openApiSpec;
