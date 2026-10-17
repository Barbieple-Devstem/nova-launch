/**
 * OpenAPI contract-test helper.
 *
 * Validates real route responses (from supertest) against the response
 * schemas documented in `src/lib/openapi/spec.ts`, so a handler that drifts
 * from its documentation fails the test suite — and therefore CI.
 *
 * What counts as drift:
 *  - the request's method + path is not documented
 *  - the response status is not documented for that operation
 *  - the documented response has a JSON schema but the body doesn't match it
 *    (missing required fields, wrong types/formats/enums, or *undocumented
 *    fields* — objects are validated as closed)
 *  - the body is JSON but the documented response has no JSON schema
 *
 * Usage:
 *
 *   const res = await request(app).get("/api/vaults/7");
 *   expectResponseToMatchSpec(res);                          // infers GET /api/vaults/{id}
 *   expectResponseToMatchSpec(res, { path: "/api/vaults/{id}" }); // or be explicit
 *
 * Mount routers in the test app at the same prefix the spec documents
 * (e.g. `/api/vaults`) so paths can be matched.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { Router } from "express";
import type { Response as SupertestResponse } from "supertest";
import { openApiSpec } from "../../lib/openapi/spec";
import {
  buildResponseSchemaIndex,
  matchPathTemplate,
  operationKey,
} from "../../lib/openapi/responseSchemas";

const index = buildResponseSchemaIndex(openApiSpec, { closeObjects: true });

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const schema of Object.values(index.components)) {
  ajv.addSchema(schema);
}

const validatorCache = new Map<string, ValidateFunction>();

function getValidator(key: string, status: string): ValidateFunction | undefined {
  const cacheKey = `${key} ${status}`;
  if (validatorCache.has(cacheKey)) return validatorCache.get(cacheKey);
  const schema = index.operations[key]?.[status]?.schema;
  if (!schema) return undefined;
  const validate = ajv.compile(schema);
  validatorCache.set(cacheKey, validate);
  return validate;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((e) => {
      const where = e.instancePath || "(root)";
      const extra =
        e.keyword === "additionalProperties"
          ? ` '${(e.params as { additionalProperty: string }).additionalProperty}'`
          : "";
      return `  - ${where} ${e.message}${extra}`;
    })
    .join("\n");
}

export interface SpecMatchOptions {
  /** HTTP method; defaults to the method supertest sent. */
  method?: string;
  /** Documented path template, e.g. `/api/vaults/{id}`; inferred from the request when omitted. */
  path?: string;
}

export interface SpecMatchResult {
  ok: boolean;
  operation?: string;
  status: string;
  message?: string;
}

/** Non-throwing variant — returns a result describing any drift. */
export function validateResponseAgainstSpec(
  res: SupertestResponse,
  opts: SpecMatchOptions = {}
): SpecMatchResult {
  const req = (res as unknown as { req?: { method?: string; path?: string } }).req;
  const method = (opts.method ?? req?.method ?? "GET").toUpperCase();
  const status = String(res.status);
  const template = opts.path ?? (req?.path ? matchPathTemplate(openApiSpec, method, req.path) : undefined);

  if (!template) {
    return { ok: false, status, message: `${method} ${req?.path ?? "(unknown path)"} is not documented in the OpenAPI spec` };
  }

  const key = operationKey(method, template);
  const responses = index.operations[key];
  if (!responses) {
    return { ok: false, status, operation: key, message: `${key} is not documented in the OpenAPI spec` };
  }

  const documented = responses[status] ?? responses.default;
  if (!documented) {
    return {
      ok: false,
      status,
      operation: key,
      message: `${key} returned ${status}, which is not a documented status (documented: ${Object.keys(responses).join(", ")})`,
    };
  }

  const isJson = /application\/json/.test(String(res.headers["content-type"] ?? ""));
  const validate = getValidator(key, responses[status] ? status : "default");

  if (!validate) {
    if (isJson && res.text) {
      return {
        ok: false,
        status,
        operation: key,
        message: `${key} ${status} returned a JSON body but the spec documents no application/json schema for it`,
      };
    }
    return { ok: true, status, operation: key };
  }

  if (!isJson) {
    return {
      ok: false,
      status,
      operation: key,
      message: `${key} ${status} is documented as application/json but responded with '${res.headers["content-type"] ?? "no content-type"}'`,
    };
  }

  if (!validate(res.body)) {
    return {
      ok: false,
      status,
      operation: key,
      message:
        `${key} ${status} response does not match the OpenAPI schema:\n` +
        `${formatErrors(validate.errors)}\n` +
        `Body: ${JSON.stringify(res.body, null, 2).slice(0, 2000)}`,
    };
  }

  return { ok: true, status, operation: key };
}

/** Throws (failing the test) when the response drifts from the spec. */
export function expectResponseToMatchSpec(res: SupertestResponse, opts: SpecMatchOptions = {}): void {
  const result = validateResponseAgainstSpec(res, opts);
  if (!result.ok) {
    throw new Error(`OpenAPI contract drift: ${result.message}`);
  }
}

/**
 * Lists the routes registered on an Express router that the spec does not
 * document, e.g. `["GET /api/vaults/{id}/foo"]`. Use it to fail CI when a
 * new endpoint is added without documentation.
 */
export function findUndocumentedRoutes(router: Router, mountPath: string): string[] {
  const undocumented: string[] = [];
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;

  for (const layer of stack) {
    if (!layer.route) continue;
    const template = (mountPath + layer.route.path)
      .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
      .replace(/\/+$/, "");
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (!enabled || method === "_all") continue;
      const key = operationKey(method, template);
      if (!index.operations[key]) undocumented.push(key);
    }
  }

  return undocumented;
}
