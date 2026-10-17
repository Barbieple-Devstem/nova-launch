/**
 * Writes the JSON Schemas derived from the OpenAPI spec's documented
 * responses (the same ones the contract tests validate against) to
 * `openapi.response-schemas.json`, for inspection or for client tooling.
 *
 *   npm run openapi:response-schemas [-- <output-path>]
 */
import { writeFileSync } from "fs";
import { openApiSpec } from "../src/lib/openapi/spec";
import { buildResponseSchemaIndex } from "../src/lib/openapi/responseSchemas";

const out = process.argv[2] ?? "openapi.response-schemas.json";
const index = buildResponseSchemaIndex(openApiSpec, { closeObjects: true });
writeFileSync(out, JSON.stringify(index, null, 2) + "\n");
console.log(
  `${out} written (${Object.keys(index.operations).length} operations, ${Object.keys(index.components).length} component schemas)`
);
