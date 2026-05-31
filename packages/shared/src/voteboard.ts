import type { Abi, Address } from 'viem';

/**
 * Shared VoteBoard demo config: the proposal everyone votes on, the seeded personas, and the
 * minimal ABI to read the live tally. The board lets ANY wallet (incl. a judge's) join the SAME
 * proposal — see contracts/src/VoteBoard.sol.
 */

/** The shared demo proposal id (kept equal to the Governor proposal for continuity). */
export const DEMO_PROPOSAL_ID =
  99019252316370500923492472570053420635813165261460609212982482510530266843538n;

/**
 * Deployed VoteBoard on Base Sepolia (script/DeployVoteBoard.s.sol broadcast 2026-05-31).
 * Seeded with 5 persona votes — 3 For, 1 Against, 1 Abstain.
 */
export const VOTE_BOARD_ADDRESS: Address = '0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B';

const ZERO = '0x0000000000000000000000000000000000000000';
export function isVoteBoardLive(addr: Address = VOTE_BOARD_ADDRESS): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr.toLowerCase() !== ZERO;
}

export type Support = 0 | 1 | 2; // 0 = Against, 1 = For, 2 = Abstain (GovernorCountingSimple order)

export interface Persona {
  name: string;
  address: Address;
  support: Support;
}

/** Personas seeded by script/DeployVoteBoard.s.sol — keep addresses + supports in sync with it. */
export const DEMO_PERSONAS: readonly Persona[] = [
  { name: 'Alice', address: '0x1e7868c6c3d0E441ACC28ee04a021a17438f364e', support: 1 },
  { name: 'Bob', address: '0xcefdaEeDe499AB111643E644283b949D0bec19eF', support: 1 },
  { name: 'Carol', address: '0x6f4DAa10107D0F88C8FA206E28BF671950F60c5F', support: 0 },
  { name: 'Dao', address: '0x7Dd2820b2F3155Bd96a90bAb2A434CE930377d32', support: 1 },
  { name: 'Eve', address: '0x1D4d5B8164A7cE3447B122787E8076092276762a', support: 2 },
];

const PERSONA_BY_ADDR: Record<string, Persona> = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.address.toLowerCase(), p]),
);

/** Map an on-chain voter address to its seeded persona (case-insensitive), if any. */
export function personaFor(address: string): Persona | undefined {
  return PERSONA_BY_ADDR[address.toLowerCase()];
}

export const SUPPORT_LABEL: Record<Support, 'Against' | 'For' | 'Abstain'> = {
  0: 'Against',
  1: 'For',
  2: 'Abstain',
};

/** getVote returns support+1 (0 = not voted); decode to a Support or null. */
export function decodeBallot(raw: number | bigint): Support | null {
  const v = Number(raw);
  return v >= 1 && v <= 3 ? ((v - 1) as Support) : null;
}

/** A DAO proposal in the rotating live feed. `seed` is index-aligned to DEMO_PERSONAS. */
export interface DaoProposal {
  id: bigint;
  title: { en: string; zh: string };
  body: { en: string; zh: string };
  seed: Support[];
}

/**
 * The rotating governance feed: realistic proposals, each pre-seeded with a DIFFERENT distribution
 * of persona votes (so the DAO visibly votes differently on each), all on the one shared VoteBoard.
 * Ids are derived from DEMO_PROPOSAL_ID so they stay distinct + big like real Governor ids.
 */
export const PROPOSALS: readonly DaoProposal[] = [
  {
    id: DEMO_PROPOSAL_ID,
    seed: [1, 1, 0, 1, 2],
    title: { en: 'Renew core-dev team budget', zh: '续期核心开发团队预算' },
    body: {
      en: 'Renew the core-dev team budget at 12,000 USDC/quarter, released against public monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Should the DAO approve?',
      zh: '将核心开发团队预算按每季度 12,000 USDC 续期,凭每月公开的里程碑报告、经 2/3 多签放款,并对未用资金设追回条款。DAO 是否批准?',
    },
  },
  {
    id: DEMO_PROPOSAL_ID + 1n,
    seed: [0, 0, 1, 2, 0],
    title: { en: '50k USDC liquidity-incentive program', zh: '5 万 USDC 流动性激励计划' },
    body: {
      en: 'Allocate 50,000 USDC from the treasury to a 6-month liquidity-incentive program for the MVOTE/USDC pool, reviewed monthly by the DAO. Approve?',
      zh: '从国库拨款 50,000 USDC,为 MVOTE/USDC 池设立 6 个月流动性激励计划,由 DAO 按月复核。是否批准?',
    },
  },
  {
    id: DEMO_PROPOSAL_ID + 2n,
    seed: [1, 2, 1, 1, 1],
    title: { en: 'Engage Spearbit for the v2 audit', zh: '聘请 Spearbit 审计 v2' },
    body: {
      en: 'Engage Spearbit to audit the v2 delegation contracts for 30,000 USDC, with the full report published before any mainnet deployment. Approve?',
      zh: '以 30,000 USDC 聘请 Spearbit 审计 v2 委托合约,完整报告须在任何主网部署前公开。是否批准?',
    },
  },
  {
    id: DEMO_PROPOSAL_ID + 3n,
    seed: [0, 1, 0, 0, 2],
    title: { en: 'Lower proposal quorum 10% → 6%', zh: '提案法定门槛 10% → 6%' },
    body: {
      en: 'Lower the proposal quorum from 10% to 6% of supply to improve participation, as a one-month trial that auto-reverts unless renewed. Approve?',
      zh: '将提案法定门槛由 10% 降至 6% 以提升参与度,试行一个月,到期不续则自动恢复。是否批准?',
    },
  },
  {
    id: DEMO_PROPOSAL_ID + 4n,
    seed: [1, 1, 1, 2, 0],
    title: { en: '100k USDC community grants round', zh: '10 万 USDC 社区资助轮' },
    body: {
      en: 'Fund a 100,000 USDC community grants round, disbursed by a 3-of-5 multisig against public deliverables and a quarterly retrospective. Approve?',
      zh: '设立 100,000 USDC 社区资助轮,由 3/5 多签凭公开交付物发放,并做季度复盘。是否批准?',
    },
  },
];

/** Minimal VoteBoard ABI: the castVote write + the tally/voters/vote reads. */
export const VOTE_BOARD_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTally',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getVoters',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'voterCount',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getVote',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [{ type: 'uint8' }],
  },
] as const satisfies Abi;
