/**
 * Seed the rotating proposal catalog onto the already-deployed VoteBoard (owner-only ownerSeed).
 * PROPOSALS[0] is seeded at deploy; this seeds the rest with their varied persona distributions.
 *
 *   DEPLOYER_PK=0x… pnpm tsx packages/shared/scripts/seed-proposals.ts
 */
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { DEMO_PERSONAS, PROPOSALS, VOTE_BOARD_ADDRESS } from '../src/index.js';

const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const PK = process.env.DEPLOYER_PK as Hex;

const OWNER_SEED_ABI = [
  {
    type: 'function',
    name: 'ownerSeed',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'voters', type: 'address[]' },
      { name: 'supportVals', type: 'uint8[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getTally',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
] as const;

async function main() {
  if (!PK) throw new Error('DEPLOYER_PK not set');
  const deployer = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(RPC) });
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const voters = DEMO_PERSONAS.map((p) => p.address);

  // PROPOSALS[0] was seeded at deploy; seed the rest.
  for (let i = 1; i < PROPOSALS.length; i++) {
    const p = PROPOSALS[i];
    const tx = await wallet.writeContract({
      address: VOTE_BOARD_ADDRESS,
      abi: OWNER_SEED_ABI,
      functionName: 'ownerSeed',
      args: [p.id, voters, p.seed],
    });
    await client.waitForTransactionReceipt({ hash: tx });
    const [a, f, ab] = (await client.readContract({
      address: VOTE_BOARD_ADDRESS,
      abi: OWNER_SEED_ABI,
      functionName: 'getTally',
      args: [p.id],
    })) as [bigint, bigint, bigint];
    console.log(`proposal[${i}] "${p.title.en}" -> against ${a} / for ${f} / abstain ${ab}  (tx ${tx})`);
  }
  console.log('\nseed complete.');
}

main().catch((e) => {
  console.error('seed-proposals FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
