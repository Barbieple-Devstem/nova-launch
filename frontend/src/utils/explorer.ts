type Network = 'testnet' | 'mainnet';
export type ExplorerLinkType = 'tx' | 'contract' | 'account';

const EXPLORER_BASE: Record<Network, string> = {
  testnet: 'https://stellar.expert/explorer/testnet',
  mainnet: 'https://stellar.expert/explorer/public',
};

export function getExplorerUrl(type: ExplorerLinkType, id: string, network: Network): string {
  return `${EXPLORER_BASE[network]}/${type}/${id}`;
}

export function getTxUrl(txHash: string, network: Network): string {
  return getExplorerUrl('tx', txHash, network);
}

export function getContractUrl(contractId: string, network: Network): string {
  return getExplorerUrl('contract', contractId, network);
}

export function getAccountUrl(accountId: string, network: Network): string {
  return getExplorerUrl('account', accountId, network);
}

/**
 * Infer the explorer link type from the shape of an identifier:
 * G… / M… (StrKey accounts), C… (contracts) or a 64-char hex tx hash.
 * Returns null when the value is none of these, so callers can skip the link.
 */
export function detectExplorerLinkType(id: string): ExplorerLinkType | null {
  if (/^[GM][A-Z2-7]{55,68}$/.test(id)) return 'account';
  if (/^C[A-Z2-7]{55}$/.test(id)) return 'contract';
  if (/^[0-9a-fA-F]{64}$/.test(id)) return 'tx';
  return null;
}
