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
 * Recorded Base mainnet 1Shot execution (2026-06-09). The Venice TEE committee decided For; that
 * decision was relayed through the 1Shot permissionless relayer (7702 burner + ERC-7710 bundle) and
 * cast on the mainnet Governor — tx 0x473d5c…0da157, verifiable on basescan.org. Produced by
 * `packages/shared/scripts/1shot-record.ts`.
 */
export const MAINNET_SNAPSHOT: MainnetSnapshot | null = {
  recordedAt: '2026-06-09T10:08:47.060Z',
  chain: { id: 8453, name: 'base', rpc: 'https://base-rpc.publicnode.com', basescan: 'https://basescan.org' },
  relayer: 'mainnet',
  proposal: {
    id: '10431134983578385489719292198641126382411519410577452838405779283242798247440',
    title: { en: 'Renew core-dev team budget', zh: '续期核心开发团队预算' },
    body: {
      en: 'Renew the core-dev team budget at 12,000 USDC/quarter, released against public monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Should the DAO approve?',
      zh: '将核心开发团队预算按每季度 12,000 USDC 续期，凭每月公开的里程碑报告、经 2/3 多签放款，并对未用资金设追回条款。DAO 是否批准？',
    },
  },
  venice: {
    model: 'e2ee-gpt-oss-120b-p',
    decision: 'For',
    support: 1,
    rationale: 'All lenses (fiscal, growth, security, participation) find low cost, milestone-gated, clawback ensures accountability',
    attestation: { verified: true, nonce: '54dfac7c0b5304ab7bad6e4b40393fc05ea96314f077223dd6ef60a4615fcf40' },
    signature: { recovered: true, signingAddress: '0x56d070df1c6be444b007839ef9cf67cec7c12b8b' },
  },
  lenses: [
    { lens: 'fiscal', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Meets lean, milestone-gated, clawback criteria; reasonable cost, low risk, strong accountability.', teeVerified: true },
    { lens: 'growth', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Accountable, low risk, supports core development growth; aligns with mandate.', teeVerified: true },
    { lens: 'security', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low risk, strong oversight, modest cost, aligns with development goals', teeVerified: true },
    { lens: 'participation', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low cost, strong accountability, aligns with DAO goals', teeVerified: true },
  ],
  vote: { txHash: '0x473d5c7ad89b34455aff2c906dedd97f0785b860eaa468c92e302a6b3d0da157', support: 1, blockNumber: '47105044', relay: '1shot' },
  oneshot: { burner: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991', feeUsdc: '0.01', gasUsed: 361548 },
};
