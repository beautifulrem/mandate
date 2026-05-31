/**
 * Provision a judge's MetaMask smart account so it can be voted-as on the VoteBoard.
 *
 * The ERC-7710 redemption executes AS the root delegator's smart account, so that account must be
 * deployed on-chain first. A judge connects an arbitrary wallet; we derive their Hybrid SA from the
 * EOA address ALONE (a keyless signer — deployment never needs their private key) and pay the
 * one-time factory deploy from DEPLOYER_PK. The derived address matches what the app derives in
 * lib/wallet.ts (same deployParams + salt), so the grant the judge signs lands on this exact SA.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

export interface ProvisionConfig {
  rpcUrl: string;
  deployerPk: Hex;
}

export interface ProvisionResult {
  sa: Address;
  deployed: boolean;
  alreadyDeployed: boolean;
  txHash?: Hex;
}

export async function provisionSmartAccount(cfg: ProvisionConfig, eoa: Address): Promise<ProvisionResult> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;

  // Address-only signer: deployment uses deployParams + salt (CREATE2), never the judge's key.
  const judgeSigner = toAccount({
    address: eoa,
    async signMessage() {
      throw new Error('provision: keyless signer cannot sign');
    },
    async signTransaction() {
      throw new Error('provision: keyless signer cannot sign');
    },
    async signTypedData() {
      throw new Error('provision: keyless signer cannot sign');
    },
  });

  const sa = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [eoa, [], [], []],
    deploySalt: '0x',
    signer: { account: judgeSigner },
  });

  if (await sa.isDeployed()) {
    return { sa: sa.address, deployed: true, alreadyDeployed: true };
  }

  const deployer = privateKeyToAccount(cfg.deployerPk);
  const { factory, factoryData } = await sa.getFactoryArgs();
  const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const txHash = await wallet.sendTransaction({ to: factory as Address, data: factoryData as Hex });
  await client.waitForTransactionReceipt({ hash: txHash });
  return { sa: sa.address, deployed: true, alreadyDeployed: false, txHash };
}
