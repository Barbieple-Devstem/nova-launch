import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'Copy' }: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <>
      <button
        type="button"
        onClick={() => void copy(value)}
        className="rounded border border-border-medium px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
        aria-label={`${label} to clipboard`}
      >
        {copied ? 'Copied' : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </>
  );
}
