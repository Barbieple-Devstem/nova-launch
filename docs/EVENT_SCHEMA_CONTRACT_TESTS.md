# Event Schema Contract Tests

Event schemas under `event-schemas/` are producer-consumer contracts. Every production schema should have a representative payload in `backend/src/__tests__/event-schema-parser-contract.test.ts` and a parser or mapper test that exercises the same field names and types.

## Adding an event

1. Add a `<event-type>.schema.json` file with `eventType`, `schemaVersion`, `required`, and `additionalProperties` explicitly set.
2. Add or update the parser that produces the event payload.
3. Add a representative parser-shaped fixture to the contract test.
4. Add a positive validation case and, for strict schemas, an unknown-field rejection case.
5. Run `npm run generate:event-types` from `backend/` and commit generated event types when the schema is part of the generated surface.
6. Add parser-specific behavior tests for malformed input, replay/idempotency, and version aliases where applicable.

The contract suite compiles each schema with AJV and verifies the representative payload. Strict schemas must reject fields not declared by the schema. The suite intentionally skips fixtureless internal/example schemas only when they are not production event contracts; adding a production schema requires adding its fixture.
