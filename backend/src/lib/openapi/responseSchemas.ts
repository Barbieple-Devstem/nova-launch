/**
 * Derives JSON Schemas for every documented response from the OpenAPI spec.
 *
 * `spec.ts` is OpenAPI 3.0, which is close to — but not quite — JSON Schema
 * (draft-07). This module performs the conversion so responses can be
 * validated with Ajv:
 *
 *  - `nullable: true` → `type: [T, "null"]` (or `anyOf [..., null]` for refs)
 *  - `#/components/schemas/X` refs → absolute `$id`s registered per schema
 *  - OpenAPI-only annotations (`example`, `deprecated`, …) are dropped
 *  - optionally, objects that declare `properties` are closed
 *    (`additionalProperties: false`) so undocumented fields count as drift
 *
 * Used by the contract-test helper (`src/__tests__/helpers/openapiContract.ts`)
 * and by `scripts/generate-response-schemas.ts`.
 */

import type { OpenAPIObject } from "openapi3-ts/oas30";

export const SCHEMA_ID_BASE = "https://nova-launch.app/openapi/schemas/";

export type JsonSchema = Record<string, unknown>;

export interface DocumentedResponse {
  /** JSON Schema for the `application/json` body, if the spec documents one. */
  schema?: JsonSchema;
  description?: string;
}

export interface ResponseSchemaIndex {
  /** Component schemas keyed by `$id` (`SCHEMA_ID_BASE + name`). */
  components: Record<string, JsonSchema>;
  /** `"GET /api/vaults/{id}"` → status code → documented response. */
  operations: Record<string, Record<string, DocumentedResponse>>;
}

export interface ConvertOptions {
  /** Close objects that declare `properties` but not `additionalProperties`. */
  closeObjects?: boolean;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head"] as const;

const DROPPED_KEYS = new Set(["example", "examples", "deprecated", "xml", "externalDocs", "discriminator"]);

export function operationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Converts one OpenAPI 3.0 schema node to JSON Schema (draft-07). */
export function toJsonSchema(node: unknown, opts: ConvertOptions = {}): unknown {
  if (Array.isArray(node)) return node.map((n) => toJsonSchema(n, opts));
  if (typeof node !== "object" || node === null) return node;

  const src = node as Record<string, unknown>;

  if (typeof src.$ref === "string") {
    const match = /^#\/components\/schemas\/(.+)$/.exec(src.$ref);
    if (!match) throw new Error(`Unsupported $ref in response schema: ${src.$ref}`);
    return { $ref: SCHEMA_ID_BASE + match[1] };
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (DROPPED_KEYS.has(key) || key === "nullable") continue;
    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toJsonSchema(v, opts)])
      );
    } else if (key === "enum" || key === "required") {
      out[key] = value;
    } else {
      out[key] = toJsonSchema(value, opts);
    }
  }

  if (opts.closeObjects && out.properties && out.additionalProperties === undefined) {
    out.additionalProperties = false;
  }

  if (src.nullable === true) {
    if (typeof out.type === "string") {
      out.type = [out.type, "null"];
      if (Array.isArray(out.enum)) out.enum = [...out.enum, null];
    } else {
      return { anyOf: [out, { type: "null" }] };
    }
  }

  return out;
}

/** Builds the per-operation, per-status response schema index from the spec. */
export function buildResponseSchemaIndex(
  spec: OpenAPIObject,
  opts: ConvertOptions = {}
): ResponseSchemaIndex {
  const components: Record<string, JsonSchema> = {};
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    const id = SCHEMA_ID_BASE + name;
    components[id] = { $id: id, ...(toJsonSchema(schema, opts) as JsonSchema) };
  }

  const operations: ResponseSchemaIndex["operations"] = {};
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = (item as Record<string, any>)[method];
      if (!op) continue;
      const responses: Record<string, DocumentedResponse> = {};
      for (const [status, response] of Object.entries<any>(op.responses ?? {})) {
        const schema = response?.content?.["application/json"]?.schema;
        responses[status] = {
          description: response?.description,
          ...(schema ? { schema: toJsonSchema(schema, opts) as JsonSchema } : {}),
        };
      }
      operations[operationKey(method, path)] = responses;
    }
  }

  return { components, operations };
}

/**
 * Finds the documented path template for a concrete request path, e.g.
 * `/api/vaults/7/withdrawals` → `/api/vaults/{id}/withdrawals`. Literal
 * segments win over parameters when several templates match.
 */
export function matchPathTemplate(
  spec: OpenAPIObject,
  method: string,
  concretePath: string
): string | undefined {
  const pathname = concretePath.split("?")[0].replace(/\/+$/, "") || "/";
  const candidates = Object.keys(spec.paths ?? {}).filter((template) => {
    const item = (spec.paths as Record<string, any>)[template];
    if (!item?.[method.toLowerCase()]) return false;
    const pattern = template
      .split("/")
      .map((seg) => (/^\{[^}]+\}$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    return new RegExp(`^${pattern}$`).test(pathname);
  });
  const paramCount = (t: string) => (t.match(/\{[^}]+\}/g) ?? []).length;
  return candidates.sort((a, b) => paramCount(a) - paramCount(b))[0];
}
