import type { Dict } from './i18n';

/**
 * Reduce a raw wallet/RPC error to ONE legible line for the toast.
 *
 * viem errors arrive as multi-part strings ("User rejected the request. Details: …
 * Version: viem@2.51.3") — judges should read a plain reason, not an SDK trace:
 * - a signature/connection the user declined in MetaMask gets its own friendly line
 * - anything else keeps only the leading sentence, with viem's Details/Version/
 *   Request Arguments sections stripped and the length capped
 */
export function humanizeError(raw: string, t: Dict): string {
  if (/user (rejected|denied|cancell?ed)/i.test(raw) || /\b4001\b/.test(raw)) return t.errUserRejected;
  const head = raw.split(/\s*(?:Details:|Version: viem@|Request Arguments:|Docs: http)/)[0];
  const line = head.split('\n')[0].trim();
  if (!line) return raw.slice(0, 220);
  return line.length > 220 ? `${line.slice(0, 219)}…` : line;
}
