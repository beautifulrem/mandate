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

  /** The mainnet VoteBoard the personas + the AI's 1Shot vote landed on (live tally source). */
  voteBoard?: Address;

  /** The real 3-hop A2A delegation chain (user → orchestrator → analyst), each hop attenuated. */
  chainFlow?: {
    participants: { user: Address; orchestrator: Address; analyst: Address };
    hashes: { root: Hex; mid: Hex; leaf: Hex };
    bounds: { rootMaxVotes: number; rootExpiry: number; midLimit: number; leafLock: string };
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
  oneshot: {
    burner: Address;
    feeUsdc: string;
    gasUsed: number;
    /** the 1Shot feeCollector the relay fee went to. */
    feeCollector: Address;
    /** the relayer EOA that broadcast the bundle and paid the ETH gas. */
    relayer: Address;
  };

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
 * Recorded Base mainnet FULL-CHAIN run (2026-06-12), produced by `pnpm 1shot:full --mainnet`. ONE
 * flow exercising every track end-to-end:
 *   A2A   user SA 0x5782… ──root(≤3 votes·7d)──▶ orchestrator 0x82FB… ──mid(≤1)──▶ analyst 0x31f8…
 *   TEE   the Venice committee (4 lenses + arbiter) decided For BEFORE the leaf was signed
 *   x402  the agent's USDC budget paid the analyst's 0.001 USDC data toll on-chain (tx 0xb244c3e4…)
 *   1Shot the relayer redeemed the 3-hop chain — castVote executed AS the user SA, the user's
 *         EIP-7702 upgrade riding the SAME relay call, the burner sponsoring the USDC fee
 *   The vote landed on the mainnet VoteBoard (0x0B87…ebeF) as a real voter (ballot recorded =
 *   support 1). Vote tx 0xc48632ca…, all verifiable on basescan.org.
 */
export const MAINNET_SNAPSHOT: MainnetSnapshot | null = {
  recordedAt: '2026-06-12T06:31:57.044Z',
  chain: { id: 8453, name: 'base', rpc: 'https://base-rpc.publicnode.com', basescan: 'https://basescan.org' },
  relayer: 'mainnet',
  proposal: {
    id: '99019252316370500923492472570053420635813165261460609212982482510530266843538',
    title: { en: 'Renew core-dev team budget', zh: '续期核心开发团队预算' },
    body: {
      en: 'Renew the core-dev team budget at 12,000 USDC/quarter, released against public monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Should the DAO approve?',
      zh: '将核心开发团队预算按每季度 12,000 USDC 续期，凭每月公开的里程碑报告、经 2/3 多签放款，并对未用资金设追回条款。DAO 是否批准？',
    },
  },
  voteBoard: '0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF',
  chainFlow: {
    participants: {
      user: '0x578215EB18099f48978dFF14a5d03a74242a0dA3',
      orchestrator: '0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B',
      analyst: '0x31f898937F29c089b748750b00668Cf8ED5a5F28',
    },
    hashes: {
      root: '0x206a9adc890f927c8ff5c44b98aa3c09bd2b77a4452f427f7dca2c896f93715a',
      mid: '0x669df36af1746caf257ac0db9671ca0ac6d4d1fd256cf817098b2560c79d0e8e',
      leaf: '0x42233d2fb9e74161697b85818b54d193ae5079e1c02fa2d286211ca984c0b9b5',
    },
    bounds: { rootMaxVotes: 3, rootExpiry: 1781850709, midLimit: 1, leafLock: 'castVote(99019252…, 1)' },
  },
  venice: {
    model: 'e2ee-gpt-oss-120b-p',
    decision: 'For',
    support: 1,
    rationale: 'All lenses — fiscal prudence, growth support, security low risk, participation accountability — endorse the modest, milestone-gated budget.',
    attestation: { verified: true, nonce: '83fbc5a93113189d879e962fce82edeac45f2ef37022f9369a42fabb8622cf9f' },
    signature: { recovered: true, signingAddress: '0x56d070df1c6be444b007839ef9cf67cec7c12b8b' },
  },
  lenses: [
    { lens: 'fiscal', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Lean, milestone-gated, clawback-protected 12k USDC/quarter aligns with mandate and presents low risk.', teeVerified: true },
    { lens: 'growth', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Credible, accountable budget supports core development with safeguards; aligns with growth mandate.', teeVerified: true },
    { lens: 'security', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low risk, strong accountability, modest cost supports development.', teeVerified: true },
    { lens: 'participation', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low cost, strong accountability, minimal risk; aligns with mandate for accessible, responsible funding.', teeVerified: true },
  ],
  vote: { txHash: '0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092', support: 1, blockNumber: '47228284', relay: '1shot' },
  oneshot: {
    burner: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991',
    feeUsdc: '0.01',
    gasUsed: 698757,
    feeCollector: '0xE936e8FAf4A5655469182A49a505055B71C17604',
    relayer: '0x7338fFC0aE8FB5C601955a65D4F5896F866cc9b8',
  },
  // Real Base-mainnet x402 micro-toll: the agent's USDC budget (the deployed burner SA) signed an
  // Erc20TransferAmount delegation; the analyst (seller) redeemed exactly 0.001 USDC. tx 0xb244c3e4…
  toll: {
    txHash: '0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    buyer: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991',
    seller: '0x31f898937F29c089b748750b00668Cf8ED5a5F28',
    amount: '1000',
    sellerBalance: '2000',
    resource: '/context/proposal-843538',
  },
};
