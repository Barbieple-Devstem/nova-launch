import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const schemaDir = resolve(__dirname, "../../../event-schemas");
const schemaFiles = readdirSync(schemaDir)
  .filter((file) => file.endsWith(".schema.json"))
  .sort();

const fixtures: Record<string, Record<string, unknown>> = {
  "burn.executed": {
    schemaVersion: 1, creatorAddress: "GCREATOR", tokenAddress: "CTOKEN",
    amount: "100", burnedBy: "GUSER", isAdminBurn: false,
    txHash: "tx-burn", timestamp: "2025-06-01T12:00:00Z",
  },
  "example.generic": { schemaVersion: 1, example: true },
  "governance.proposal.statusChanged": {
    schemaVersion: 1, creatorAddress: "GCREATOR", proposalId: 1,
    tokenAddress: "CTOKEN", status: "passed", previousStatus: "active",
    txHash: "tx-status", timestamp: "2025-06-01T12:00:00Z",
  },
  "governance.proposal.voteCast": {
    schemaVersion: 1, creatorAddress: "GCREATOR", proposalId: 1,
    tokenAddress: "CTOKEN", voter: "GVOTER", support: true,
    weight: "10", votesFor: "10", votesAgainst: "0", reason: null,
    txHash: "tx-vote", timestamp: "2025-06-01T12:00:00Z",
  },
  "token.deployed": {
    schemaVersion: 1, tokenAddress: "CTOKEN", creatorAddress: "GCREATOR",
    name: "Nova", symbol: "NOVA", totalSupply: "1000", txHash: "tx-token",
    timestamp: "2025-06-01T12:00:00Z",
  },
  "vault.matured": {
    schemaVersion: 1, creatorAddress: "GCREATOR", vaultId: 1,
    recipientAddress: "GRECIPIENT", amount: "100", txHash: "tx-vault",
    timestamp: "2025-06-01T12:00:00Z",
  },
};

const ajv = new Ajv({ strict: false, allErrors: true, validateSchema: false });
addFormats(ajv);

describe("event schema and parser contract", () => {
  for (const file of schemaFiles) {
    const schema = JSON.parse(readFileSync(resolve(schemaDir, file), "utf8"));
    const eventType = schema.eventType as string;
    if (!fixtures[eventType]) continue;
    const validate = ajv.compile(schema);

    it(`${eventType} accepts the representative parser payload`, () => {
      expect(validate(fixtures[eventType])).toBe(true);
    });

    if (schema.additionalProperties === false) {
      it(`${eventType} rejects unknown fields`, () => {
        expect(validate({ ...fixtures[eventType], unexpectedField: true })).toBe(false);
        expect(validate.errors?.some((error) => error.keyword === "additionalProperties")).toBe(true);
      });
    }
  }

  it("keeps every production schema mapped to a parser fixture", () => {
    const coveredTypes = new Set(
      schemaFiles
        .map((file) => JSON.parse(readFileSync(resolve(schemaDir, file), "utf8")).eventType)
        .filter((eventType) => eventType in fixtures)
    );
    expect(coveredTypes).toEqual(new Set(Object.keys(fixtures)));
  });
});
