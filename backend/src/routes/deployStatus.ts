import { Router, Request, Response } from "express";
import axios from "axios";
import { successResponse, errorResponse } from "../utils/response";

const router = Router();
export type ConfirmationStep = "submitted" | "pending" | "confirming" | "finalized";
export interface ConfirmationStatusResponse {
  txHash: string;
  step: ConfirmationStep;
  confirmations?: number;
  totalConfirmations: number;
  ledger?: number;
  reason?: string;
}

const TOTAL_CONFIRMATIONS = 7;
const DEFAULT_STREAM_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

function getHorizonUrl(network: string): string {
  if (process.env.STELLAR_HORIZON_URL) return process.env.STELLAR_HORIZON_URL;
  return network === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
}

function validateRequest(txHash: string, network: string): string | null {
  if (!txHash || !/^[a-f0-9]{64}$/i.test(txHash)) return "INVALID_TX_HASH";
  if (!["testnet", "mainnet"].includes(network)) return "INVALID_NETWORK";
  return null;
}

export async function getConfirmationStatus(txHash: string, network: string): Promise<ConfirmationStatusResponse> {
  const horizonUrl = getHorizonUrl(network);
  let txData: { successful: boolean; ledger?: number };
  try {
    const response = await axios.get(`${horizonUrl}/transactions/${txHash}`, { timeout: 10_000 });
    txData = response.data as { successful: boolean; ledger?: number };
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return { txHash, step: "submitted", totalConfirmations: TOTAL_CONFIRMATIONS };
    }
    throw err;
  }

  if (!txData.successful) {
    return { txHash, step: "submitted", totalConfirmations: TOTAL_CONFIRMATIONS, reason: "Transaction failed on-chain" };
  }
  if (!txData.ledger) {
    return { txHash, step: "pending", totalConfirmations: TOTAL_CONFIRMATIONS };
  }

  let confirmations = 1;
  try {
    const ledgerResp = await axios.get(`${horizonUrl}/ledgers?order=desc&limit=1`, { timeout: 10_000 });
    const latestLedger: number = ledgerResp.data?._embedded?.records?.[0]?.sequence ?? txData.ledger;
    confirmations = Math.max(1, latestLedger - txData.ledger + 1);
  } catch {
    // A transaction seen in a ledger has at least one confirmation.
  }

  return {
    txHash,
    step: confirmations >= TOTAL_CONFIRMATIONS ? "finalized" : "confirming",
    confirmations: Math.min(confirmations, TOTAL_CONFIRMATIONS),
    totalConfirmations: TOTAL_CONFIRMATIONS,
    ledger: txData.ledger,
  };
}

router.get("/:txHash", async (req: Request, res: Response) => {
  const { txHash } = req.params;
  const network = (req.query.network as string) || "testnet";
  const validationError = validateRequest(txHash, network);
  if (validationError) {
    return res.status(400).json(errorResponse({
      code: validationError,
      message: validationError === "INVALID_TX_HASH" ? "txHash must be a 64-character hex string" : "network must be testnet or mainnet",
    }));
  }

  try {
    return res.json(successResponse(await getConfirmationStatus(txHash, network)));
  } catch (error) {
    console.error("Error fetching deploy status:", error);
    return res.status(502).json(errorResponse({ code: "HORIZON_ERROR", message: "Failed to fetch transaction status from Horizon" }));
  }
});

/** Stream only status transitions; comments are heartbeats for idle connections. */
router.get("/:txHash/events", async (req: Request, res: Response) => {
  const { txHash } = req.params;
  const network = (req.query.network as string) || "testnet";
  const validationError = validateRequest(txHash, network);
  if (validationError) {
    return res.status(400).json(errorResponse({
      code: validationError,
      message: validationError === "INVALID_TX_HASH" ? "txHash must be a 64-character hex string" : "network must be testnet or mainnet",
    }));
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  let lastStatus: string | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  const heartbeatTimer = setInterval(() => {
    if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_INTERVAL_MS);
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pollTimer) clearTimeout(pollTimer);
    clearInterval(heartbeatTimer);
  };
  req.on("close", cleanup);

  const writeStatus = (status: ConfirmationStatusResponse) => {
    const serialized = JSON.stringify(status);
    if (closed || serialized === lastStatus) return;
    lastStatus = serialized;
    res.write(`event: deployment_status\ndata: ${serialized}\n\n`);
  };

  const poll = async (): Promise<void> => {
    if (closed) return;
    try {
      const status = await getConfirmationStatus(txHash, network);
      writeStatus(status);
      if (status.step === "finalized" || status.reason) {
        cleanup();
        if (!res.writableEnded) res.end();
        return;
      }
    } catch {
      if (!closed) res.write(`event: error\ndata: ${JSON.stringify({ code: "HORIZON_ERROR", message: "Failed to fetch transaction status from Horizon" })}\n\n`);
    }
    if (!closed) {
      const configuredInterval = Number(process.env.DEPLOY_STATUS_STREAM_INTERVAL_MS);
      const interval = Number.isFinite(configuredInterval) ? Math.max(500, configuredInterval) : DEFAULT_STREAM_INTERVAL_MS;
      pollTimer = setTimeout(() => void poll(), interval);
    }
  };

  void poll();
});

export default router;
