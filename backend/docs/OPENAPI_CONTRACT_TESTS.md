# OpenAPI Contract Tests

Route responses are validated against the response schemas in
[`src/lib/openapi/spec.ts`](../src/lib/openapi/spec.ts). If a handler's response stops matching
its documentation, the tests fail, and the blocking `OpenAPI contract tests (fail on drift)`
step in `backend-ci.yml` fails CI.

Covered route groups: **tokens**, **streams**, **vaults** and **governance**
(`src/__tests__/contract/*.contract.test.ts`).

```bash
npm run test:contract              # contract suites + spec structure tests
npm run openapi:response-schemas   # optional: dump the derived JSON Schemas to openapi.response-schemas.json
```

## How it works

1. `src/lib/openapi/responseSchemas.ts` converts every documented `application/json` response
   from OpenAPI 3.0 to JSON Schema draft-07:
   - `nullable` becomes a `null` type.
   - `$ref`s become absolute schema ids.
   - OpenAPI-only annotations are dropped.
2. `src/__tests__/helpers/openapiContract.ts` loads those schemas into Ajv (with formats) and
   exposes:
   - `expectResponseToMatchSpec(res, { method?, path? })` fails the test when the response
     drifts. It infers the method and the documented path template from the supertest request.
   - `validateResponseAgainstSpec(...)` is a non-throwing variant.
   - `findUndocumentedRoutes(router, mountPath)` lists routes registered on an Express router
     that the spec doesn't document.

### What counts as drift

| Check | Example failure |
| --- | --- |
| Operation not documented | `GET /api/vaults/{id}/foo is not documented in the OpenAPI spec` |
| Status not documented | `GET /api/vaults/{id} returned 409, which is not a documented status` |
| Body doesn't match the schema | Missing required field, wrong type, format or enum |
| **Undocumented field** | Objects are validated as closed (`additionalProperties: false`) unless the schema says otherwise |
| JSON body with no documented schema | A response was documented with a description only |
| Route registered but not documented | Reported by `findUndocumentedRoutes` |

## Writing a contract test

Mount the router at the prefix the spec documents, mock its data layer, and assert every status
the route can return:

```ts
const app = express();
app.use(express.json());
app.use("/api/vaults", vaultRoutes);

it("200", async () => {
  vi.mocked(streamProjectionService.getStreamById).mockResolvedValue(vault(7));
  const res = await request(app).get("/api/vaults/7");
  expect(res.status).toBe(200);
  expectResponseToMatchSpec(res); // validated against GET /api/vaults/{id} → 200
});
```

Mock data should mirror what the data layer really returns. Use Prisma `BigInt`s, `Date`s, and
`null` versus omitted (`undefined`) fields, so the test exercises the route's real serialization.

## Fixing a drift failure

Decide which side is wrong:

- **The response is wrong** (an accidental field leak, or a wrong type): fix the handler.
- **The documentation is stale**: update `spec.ts` in the same PR. Then regenerate
  `openapi.json` if you maintain it (`npm run docs:generate`).

## Spec corrections made when the suite was introduced

Turning the suite on showed that the following docs no longer matched the code. They were
corrected:

- **Error shapes.** Three shapes are now documented. `ApiErrorEnvelope` is the
  `errorResponse()` shape, with `error` as an object. `ErrorResponse` is the legacy shape,
  where `error` is a string. `ValidationErrorResponse` is what express-validator returns.
  Tenant-scoped routes can also return the bare `TenantError` shape from `tenantMiddleware`.
- **Streams.** `/api/streams` serves off-chain stream metadata at `/{streamId}/metadata` (GET
  and PUT), `/creator/{address}` and `/recipient/{address}`. The previously documented
  `/stats/{address}` and `/{id}` paths don't exist. `StreamRecord` now describes
  `PaymentStreamMetadata`.
- **Vaults.** `VaultRecord` now matches the `Stream` projection: `streamId`, `recipient`,
  `txHash`, and statuses `CREATED`, `CLAIMED` and `CANCELLED`. `/api/vaults/{id}/withdrawals`
  is now documented.
- **Governance.** The path parameter is `{proposalId}` (integer). `ProposalRecord` matches the
  Prisma model, including `QUEUED`. `/execution`, `/queue`, `/stats`, `/voters/{address}` and
  `POST /events/ingest` are now documented.
- **Tokens.** `/api/tokens/batch` and `/api/tokens/deployment-status/{txHash}` are now
  documented. The search response's `filters` object is documented too.

> Note: `routes/streams.ts` is not currently mounted in `src/index.ts`. The contract tests
> mount it directly, at the prefix its documentation uses.
