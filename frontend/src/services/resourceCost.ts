/**
 * Soroban resource cost estimation
 *
 * Turns a `simulateTransaction` response into a human-readable estimate of
 * the fee and resources a contract call will consume, so it can be shown to
 * the user before they are asked to sign.
 *
 * Issue: #2173
 */

import { BASE_FEE, rpc as Soroban } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import { decodeSimulationError } from './stellarErrors';

const STROOPS_PER_XLM = 10_000_000n;

export interface ResourceCostEstimate {
  /** Inclusion (base) fee in stroops */
  inclusionFee: bigint;
  /** Minimum Soroban resource fee reported by simulation, in stroops */
  resourceFee: bigint;
  /** inclusionFee + resourceFee, in stroops */
  totalFee: bigint;
  /** CPU instructions the call is expected to use */
  cpuInstructions?: number;
  /** Memory bytes the call is expected to use (when the RPC reports it) */
  memoryBytes?: number;
  /** Ledger bytes read */
  readBytes?: number;
  /** Ledger bytes written */
  writeBytes?: number;
  /** Ledger entries read (read-only + read-write footprint) */
  readEntries?: number;
  /** Ledger entries written (read-write footprint) */
  writeEntries?: number;
}

export interface ResourceCostError {
  /** Readable explanation suitable for display */
  message: string;
  /** Optional hint on how to recover */
  suggestion?: string;
  /** Machine-readable error code */
  code: string;
  /** Raw simulation detail, for logs only */
  debugDetail?: string;
}

export type ResourceCostResult =
  | { ok: true; estimate: ResourceCostEstimate }
  | { ok: false; error: ResourceCostError };

/** Format a stroop amount as XLM with up to 7 decimal places. */
export function formatStroopsAsXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = (abs % STROOPS_PER_XLM).toString().padStart(7, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''} XLM`;
}

/** Format a byte count compactly (B / KB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(typeof value === 'object' && value !== null && 'toString' in value ? value.toString() : value);
  return Number.isFinite(n) ? n : undefined;
}

function call(target: any, ...names: string[]): unknown {
  for (const name of names) {
    if (target && typeof target[name] === 'function') {
      return target[name]();
    }
  }
  return undefined;
}

/**
 * Pull resource usage out of the simulated `SorobanTransactionData`.
 * Field names differ across SDK/protocol versions (e.g. `readBytes` became
 * `diskReadBytes`), so each lookup tolerates either shape.
 */
function extractResources(sim: any): Partial<ResourceCostEstimate> {
  try {
    const data = typeof sim.transactionData?.build === 'function'
      ? sim.transactionData.build()
      : sim.transactionData;
    const resources: any = call(data, 'resources');
    if (!resources) return {};

    const footprint: any = call(resources, 'footprint');
    const readOnly = call(footprint, 'readOnly') as unknown[] | undefined;
    const readWrite = call(footprint, 'readWrite') as unknown[] | undefined;

    return {
      cpuInstructions: toNumber(call(resources, 'instructions')),
      readBytes: toNumber(call(resources, 'diskReadBytes', 'readBytes')),
      writeBytes: toNumber(call(resources, 'writeBytes')),
      readEntries:
        readOnly || readWrite ? (readOnly?.length ?? 0) + (readWrite?.length ?? 0) : undefined,
      writeEntries: readWrite ? readWrite.length : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Convert a simulation response into a cost estimate or a readable error.
 *
 * @param sim - Response from `server.simulateTransaction`
 * @param inclusionFee - Base inclusion fee in stroops (defaults to BASE_FEE)
 */
export function parseResourceCost(
  sim: Soroban.Api.SimulateTransactionResponse,
  inclusionFee: bigint = BigInt(BASE_FEE),
): ResourceCostResult {
  if (Soroban.Api.isSimulationError(sim)) {
    const decoded = decodeSimulationError(sim);
    return {
      ok: false,
      error: {
        code: decoded.code,
        message: decoded.userMessage,
        suggestion: decoded.retrySuggestion,
        debugDetail: decoded.debugDetail,
      },
    };
  }

  if (Soroban.Api.isSimulationRestore(sim)) {
    return {
      ok: false,
      error: {
        code: 'SIMULATION_FAILED',
        message: 'Some contract data this call needs has expired and must be restored first.',
        suggestion: 'Restore the archived ledger entries, then try again.',
      },
    };
  }

  let resourceFee = 0n;
  try {
    resourceFee = BigInt((sim as Soroban.Api.SimulateTransactionSuccessResponse).minResourceFee ?? '0');
  } catch {
    resourceFee = 0n;
  }

  const cost = (sim as any).cost;
  const resources = extractResources(sim);

  return {
    ok: true,
    estimate: {
      inclusionFee,
      resourceFee,
      totalFee: inclusionFee + resourceFee,
      memoryBytes: toNumber(cost?.memBytes),
      ...resources,
      // Older RPCs report CPU only via `cost`; prefer the transaction data value when present.
      cpuInstructions: resources.cpuInstructions ?? toNumber(cost?.cpuInsns),
    },
  };
}

/**
 * Simulate `tx` and return its resource cost estimate. Network failures are
 * reported as a readable error rather than thrown.
 */
export async function estimateResourceCost(
  server: Pick<Soroban.Server, 'simulateTransaction'>,
  tx: Transaction,
): Promise<ResourceCostResult> {
  let sim: Soroban.Api.SimulateTransactionResponse;
  try {
    sim = await server.simulateTransaction(tx);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the Soroban RPC to estimate fees.',
        suggestion: 'Check your connection and try again.',
        debugDetail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // The fee already on the transaction includes any resource fee set by
  // prepareTransaction; the inclusion fee is the per-operation base fee.
  const operations = Math.max(tx.operations?.length ?? 1, 1);
  return parseResourceCost(sim, BigInt(BASE_FEE) * BigInt(operations));
}
