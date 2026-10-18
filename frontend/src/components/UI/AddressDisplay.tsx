import type { MouseEvent } from 'react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { getStoredNetwork } from '../../hooks/useNetwork';
import { shortenAddress } from '../../utils/formatting';
import {
  detectExplorerLinkType,
  getExplorerUrl,
  type ExplorerLinkType,
} from '../../utils/explorer';

export interface AddressDisplayProps {
  /** Account (G…/M…), contract (C…) or transaction hash. */
  address: string;
  /** Network for the explorer link. Defaults to the user's saved network. */
  network?: 'testnet' | 'mainnet';
  /** Explorer link type. Inferred from the address format when omitted. */
  type?: ExplorerLinkType;
  /** Characters kept on each side of the ellipsis. */
  chars?: number;
  /** Render the full value instead of the short form. */
  showFull?: boolean;
  /** Show a copy-to-clipboard button. */
  copyable?: boolean;
  /**
   * Show a link to the block explorer. Turn off when the component is
   * rendered inside another link or button, since links cannot nest.
   */
  showExplorerLink?: boolean;
  className?: string;
}

/**
 * Consistent rendering of on-chain identifiers: a monospace short form
 * ("GABC…WXYZ") with the full value on hover, a copy button, and a link to
 * stellar.expert for the current network.
 */
export function AddressDisplay({
  address,
  network,
  type,
  chars = 4,
  showFull = false,
  copyable = true,
  showExplorerLink = true,
  className = '',
}: AddressDisplayProps) {
  const { copied, copy } = useCopyToClipboard();
  const linkType = type ?? detectExplorerLinkType(address);
  const explorerUrl =
    showExplorerLink && linkType
      ? getExplorerUrl(linkType, address, network ?? getStoredNetwork())
      : null;

  const handleCopy = (event: MouseEvent<HTMLButtonElement>) => {
    // Rows and cards that contain addresses are often clickable themselves.
    event.preventDefault();
    event.stopPropagation();
    void copy(address);
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono align-middle ${className}`}
      data-testid="address-display"
    >
      <span title={address}>
        {showFull ? address : shortenAddress(address, chars)}
      </span>

      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-6 w-6 items-center justify-center rounded opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label={copied ? 'Copied' : 'Copy address'}
          title={copied ? 'Copied' : 'Copy address'}
          data-testid="address-display-copy"
        >
          {copied ? (
            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          <span className="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
        </button>
      )}

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-6 w-6 items-center justify-center rounded opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="View on block explorer"
          title="View on block explorer"
          data-testid="address-display-explorer"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </span>
  );
}

export default AddressDisplay;
