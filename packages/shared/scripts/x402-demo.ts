/**
 * T17 — x402 + ERC-7710 micropayment demo (Base Sepolia, testnet only).
 *
 * A self-built data seller charges per query. The buyer (a smart account holding MVOTE credits)
 * gets a 402, signs a SCOPED Erc20TransferAmount delegation, and the seller redeems it on-chain to
 * settle, then returns the data. Distinct from the Venice analyst (prepaid API key).
 *
 *   pnpm tsx packages/shared/scripts/x402-demo.ts
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { createPublicClient, createWalletClient, erc20Abi, http as viemHttp, parseUnits, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  ADDRESSES,
  build402,
  buildPaymentDelegation,
  decodePayment,
  delegationManagerAddress,
  encodePayment,
  settlePaymentCalldata,
  verifyPayment,
  type Delegation,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const PORT = 8799;
const pk = (n: string) => process.env[n] as Hex;

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const asset = ADDRESSES.baseSepolia.token as Address; // reuse MVOTE as the per-query "data credits"
  if (!asset) throw new Error('deploy first (no token in addresses.ts)');
  const client = createPublicClient({ chain: baseSepolia, transport: viemHttp(RPC) }) as PublicClient;
  const environment = getSmartAccountsEnvironment(baseSepolia.id);
  const dm = delegationManagerAddress(baseSepolia.id);
  const price = parseUnits('1', 18); // 1 MVOTE per query

  const deployer = privateKeyToAccount(pk('DEPLOYER_PK'));
  const sellerEoa = privateKeyToAccount(pk('ANALYST_PK')); // the data seller (funded, submits the settle)
  const buyerEoa = privateKeyToAccount(pk('ORCHESTRATOR_PK'));
  const buyerSA = await toMetaMaskSmartAccount({ client, implementation: Implementation.Hybrid, deployParams: [buyerEoa.address, [], [], []], deploySalt: '0x', signer: { account: buyerEoa } });
  if (!(await buyerSA.isDeployed())) throw new Error('buyer SA not deployed — run vote-2hop once');
  const balOf = (a: Address) => client.readContract({ address: asset, abi: erc20Abi, functionName: 'balanceOf', args: [a] }) as Promise<bigint>;

  // top up the buyer's data credits if needed (owner mint).
  if ((await balOf(buyerSA.address)) < price) {
    console.log('› minting MVOTE data-credits to the buyer…');
    const dWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: viemHttp(RPC) });
    const tx = await dWallet.writeContract({ address: asset, abi: [{ type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] }], functionName: 'mint', args: [buyerSA.address, price * 10n] });
    await client.waitForTransactionReceipt({ hash: tx });
  }
  const sellerBefore = await balOf(sellerEoa.address);

  // (1) the self-built seller: 402 without payment; verify + settle on-chain with it.
  const server = http.createServer(async (req, res) => {
    const json = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (!req.url?.startsWith('/context/')) return json(404, { error: 'not found' });
    const payment = req.headers['x-payment'] as string | undefined;
    if (!payment) return json(402, build402({ asset, payTo: sellerEoa.address, amount: price, chainId: baseSepolia.id, resource: req.url }));
    const del = decodePayment(payment);
    const v = verifyPayment(del, build402({ asset, payTo: sellerEoa.address, amount: price, chainId: baseSepolia.id, resource: req.url }).accepts[0]);
    if (!v.ok) return json(402, { error: v.reason });
    const sellerWallet = createWalletClient({ account: sellerEoa, chain: baseSepolia, transport: viemHttp(RPC) });
    const settleTx = await sellerWallet.sendTransaction({ to: dm, data: settlePaymentCalldata(del as Delegation, asset, sellerEoa.address, price) });
    await client.waitForTransactionReceipt({ hash: settleTx });
    json(200, { resource: req.url, data: 'Forum sentiment: 62% in favor; 3 delegates flagged clawback ambiguity.', settleTx });
  });
  await new Promise<void>((r) => server.listen(PORT, r));

  // (2) the buyer: GET → 402 → sign payment → retry → data.
  const url = `http://localhost:${PORT}/context/proposal-42`;
  const first = await fetch(url);
  console.log(`\n› GET ${url} → ${first.status} ${first.status === 402 ? 'Payment Required' : ''}`);
  const reqs = (await first.json()).accepts[0];
  console.log(`  pay ${Number(reqs.maxAmountRequired) / 1e18} MVOTE to ${reqs.payTo} (scheme ${reqs.scheme})`);

  const del = buildPaymentDelegation({ buyer: buyerSA.address, seller: sellerEoa.address, asset, amount: BigInt(reqs.maxAmountRequired), environment });
  const signed: Delegation = { ...del, signature: (await buyerSA.signDelegation({ delegation: del })) as Hex };
  console.log('  signed scoped Erc20TransferAmount delegation (buyer→seller)');

  const second = await fetch(url, { headers: { 'x-payment': encodePayment(signed) } });
  const body = await second.json();
  console.log(`\n› retry with X-PAYMENT → ${second.status}`);
  console.log(`  data: "${body.data}"`);
  console.log(`  settled on-chain: ${body.settleTx}`);

  const sellerAfter = await balOf(sellerEoa.address);
  server.close();
  if (second.status !== 200 || sellerAfter - sellerBefore !== price) {
    throw new Error(`x402 settlement mismatch (seller +${sellerAfter - sellerBefore}, expected ${price})`);
  }
  console.log(`\n✅ x402 + ERC-7710: 402 → scoped delegation → on-chain settle (+${Number(price) / 1e18} MVOTE to seller) → data.`);
}

main().catch((e) => { console.error('\nx402-demo FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
