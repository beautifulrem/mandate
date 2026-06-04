import { build402 } from '@mandate/shared';
import type { Address } from 'viem';

/**
 * x402 pay-per-query toll, settled with a SCOPED ERC-7710 Erc20TransferAmount delegation.
 * The analyst's context feed charges 1 mUSDC per query; the buyer signs a delegation that lets
 * the seller pull AT MOST the toll, to itself, and nothing else. Mirrors packages/shared/x402.ts.
 */
export const TOLL_PRICE_ATOMS = 1_000_000n; // 1 mUSDC per query (6 decimals)
export const TOLL_DECIMALS = 6;
export const TOLL_SYMBOL = 'mUSDC';
export const TOLL_RESOURCE = '/context/proposal-42';
/** x402 budget (in queries) when a grant is bounded by TIME only (no vote cap). cap = N x 1 mUSDC. */
export const DEFAULT_QUERY_BUDGET = 25;

/** The priced resource for a proposal — `/context/proposal-<last-6-of-id>` (matches the HUD's #id). */
export function tollResource(proposalId?: bigint | string | null): string {
  return proposalId != null && proposalId !== '' ? `/context/proposal-${String(proposalId).slice(-6)}` : TOLL_RESOURCE;
}

/** The 402 -> sign-scope -> settle -> 200 toll lifecycle, shown as an animated stepper. */
export const X402_PHASES = [
  { key: 'require', code: 402 },
  { key: 'sign', code: null },
  { key: 'settle', code: null },
  { key: 'data', code: 200 },
] as const;

export type X402PhaseKey = (typeof X402_PHASES)[number]['key'];

/** Atoms -> trimmed decimal string (1500000000000000000n,18 -> "1.5"; 10n**18n,18 -> "1"). */
export function formatTokenAmount(atoms: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = atoms / base;
  const frac = atoms % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Build the real x402 (scheme erc7710) 402 challenge for the per-query data toll. */
export function tollChallenge(opts: { asset: Address; payTo: Address; chainId: number; resource?: string }) {
  return build402({
    asset: opts.asset,
    payTo: opts.payTo,
    amount: TOLL_PRICE_ATOMS,
    chainId: opts.chainId,
    resource: opts.resource ?? TOLL_RESOURCE,
  });
}
