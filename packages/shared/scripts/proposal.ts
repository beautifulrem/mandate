/**
 * Demo-clock CLI for the Governor's short Active window.
 *
 *   pnpm proposal                 # print the current proposal's window
 *   pnpm proposal --wait          # poll until it is Active
 *   pnpm proposal --min 120       # exit 1 unless Active with >= 120s left
 *   pnpm proposal --reseed        # create a fresh proposal, wait for Active, update addresses.ts
 *
 * --reseed signs with DEPLOYER_PK (from .env); status/wait are read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import {
  assertUsableWindow,
  demoProposalAction,
  fetchProposalWindow,
  GOVERNOR_ABI,
  ProposalState,
  reseedProposal,
  type ProposalWindow,
} from '../src/proposal.js';
import { ADDRESSES } from '../src/addresses.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const ADDRESSES_PATH = path.resolve(SCRIPT_DIR, '../src/addresses.ts');
const DEFAULT_RPC = 'https://base-sepolia-rpc.publicnode.com';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function describe(window: ProposalWindow): string {
  if (window.phase === 'pending') return `pending — Active in ${window.secondsUntilActive}s`;
  if (window.phase === 'active') return `Active — ${window.secondsRemaining}s left`;
  return 'closed';
}

function writeProposalId(id: bigint): void {
  const src = fs.readFileSync(ADDRESSES_PATH, 'utf8');
  const next = src.replace(/("proposalId":\s*")\d+(")/, `$1${id.toString()}$2`);
  if (next === src) throw new Error('could not update proposalId in addresses.ts');
  fs.writeFileSync(ADDRESSES_PATH, next);
}

async function pollUntilActive(
  client: PublicClient,
  governor: Address,
  proposalId: bigint,
): Promise<ProposalWindow> {
  for (let i = 0; i < 40; i++) {
    const { window } = await fetchProposalWindow(client, governor, proposalId);
    process.stdout.write(`  ${describe(window)}\n`);
    if (window.phase === 'active') return window;
    if (window.phase === 'closed') throw new Error('proposal closed before becoming active');
    await sleep(5000);
  }
  throw new Error('timed out waiting for Active');
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const governor = ADDRESSES.baseSepolia.governor;
  const token = ADDRESSES.baseSepolia.token;
  if (!governor || !ADDRESSES.baseSepolia.proposalId) {
    throw new Error('no governor/proposalId in addresses.ts — run the T5 deploy first');
  }
  let proposalId = BigInt(ADDRESSES.baseSepolia.proposalId);

  const rpc = process.env.BASE_SEPOLIA_RPC_URL || DEFAULT_RPC;
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) }) as PublicClient;

  if (flag('reseed')) {
    const pk = process.env.DEPLOYER_PK as Hex | undefined;
    if (!pk) throw new Error('--reseed needs DEPLOYER_PK in .env');
    if (!token) throw new Error('--reseed needs a token address in addresses.ts');
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) });
    const description = `Mandate demo: signal proposal @ ${process.env.RESEED_NONCE ?? new Date().toISOString()}`;

    console.log('› reseeding proposal…');
    const txHash = await reseedProposal(wallet, account, governor, token, description);
    await client.waitForTransactionReceipt({ hash: txHash });

    const { targets, values, calldatas } = demoProposalAction(token);
    const descriptionHash = keccak256(stringToHex(description));
    proposalId = (await client.readContract({
      address: governor,
      abi: GOVERNOR_ABI,
      functionName: 'hashProposal',
      args: [targets as Address[], values as bigint[], calldatas as Hex[], descriptionHash],
    })) as bigint;

    writeProposalId(proposalId);
    console.log(`  new proposalId ${proposalId} (tx ${txHash}) → addresses.ts updated`);
  }

  let { window, state } = await fetchProposalWindow(client, governor, proposalId);
  console.log(`proposal ${proposalId}`);
  console.log(`  state=${ProposalState[state]} · ${describe(window)}`);

  if (flag('wait') && window.phase === 'pending') {
    window = await pollUntilActive(client, governor, proposalId);
  }

  const min = flagValue('min');
  if (min !== undefined) {
    assertUsableWindow(window, Number(min));
    console.log(`  OK: Active with >= ${min}s left`);
  }
}

main().catch((err) => {
  console.error('proposal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
