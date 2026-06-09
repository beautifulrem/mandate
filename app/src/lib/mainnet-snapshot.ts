import type { Address, Hex } from 'viem';
import type { LensVerdict } from '@mandate/shared';

/**
 * A recorded UNIFIED 1Shot run, produced by `packages/shared/scripts/1shot-record.ts`:
 * the Venice TEE committee decides the support, then that decided castVote is relayed through the
 * 1Shot permissionless relayer (EIP-7702 burner upgrade + ERC-7710 bundle). Every field is a REAL
 * on-chain / TEE artifact. The OneShotFinale replays it.
 */
export interface MainnetSnapshot {
  recordedAt: string;

  chain: { id: number; name: string; rpc: string; basescan: string };
  /** which 1Shot relayer leg this run was relayed through. */
  relayer: 'mainnet' | 'testnet';

  proposal: {
    id: string;
    title: { en: string; zh: string };
    body: { en: string; zh: string };
  };

  /** Venice TEE final decision (the synthesis of the 4 lenses) — drives the relayed castVote's support. */
  venice: {
    model: string;
    decision: 'For' | 'Against' | 'Abstain';
    support: 0 | 1 | 2;
    rationale: string;
    reasoning?: string;
    attestation: { verified: boolean; nonce?: string };
    signature: { recovered: boolean; signingAddress?: Address };
  };

  /** The four lens verdicts the committee reported. */
  lenses: LensVerdict[];

  /** The 1Shot-relayed castVote (the support == venice.support). */
  vote: { txHash: Hex; support: 0 | 1 | 2; blockNumber: string; relay: '1shot' };

  /** 1Shot-specific evidence: the 7702-upgraded burner, the USDC fee, gas (paid by the relayer). */
  oneshot: { burner: Address; feeUsdc: string; gasUsed: number };

  /** Optional x402 toll, if a toll was settled alongside the run (the main flow always demonstrates it). */
  toll?: {
    txHash: Hex;
    asset: Address;
    buyer: Address;
    seller: Address;
    amount: string;
    sellerBalance: string;
    resource: string;
  };
}

/**
 * Recorded 1Shot execution. Populated by pasting the JSON from `1shot-record.ts`.
 * null until the one-time recording is done (the OneShotFinale falls back to the pinned MAINNET_PROOF).
 */
export const MAINNET_SNAPSHOT: MainnetSnapshot | null = null;
