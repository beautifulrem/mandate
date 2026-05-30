/**
 * x402 + ERC-7710 micropayments: a self-built data seller charges per query, and the buyer pays
 * with a SCOPED ERC-7710 delegation (Erc20TransferAmount) that the seller redeems on-chain to
 * settle. This is the pay-per-query rail — distinct from the Venice analyst (prepaid API key).
 */
import {
  contracts,
  createDelegation,
  createExecution,
  ExecutionMode,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import type { Delegation, SmartAccountsEnvironment } from './delegation.js';

/** A single accepted payment method in a 402 response. */
export interface PaymentRequirements {
  scheme: 'erc7710';
  network: string; // CAIP-2, e.g. eip155:84532
  asset: Address; // payment token
  payTo: Address; // the seller
  maxAmountRequired: string; // atoms
  resource: string; // what is being sold
}

/** The body of an HTTP 402 response. */
export interface PaymentRequired {
  x402Version: 1;
  accepts: PaymentRequirements[];
  error?: string;
}

/** Pure: build the 402 payment-required body for a query. */
export function build402(opts: {
  asset: Address;
  payTo: Address;
  amount: bigint;
  chainId: number;
  resource: string;
}): PaymentRequired {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'erc7710',
        network: `eip155:${opts.chainId}`,
        asset: opts.asset,
        payTo: opts.payTo,
        maxAmountRequired: opts.amount.toString(),
        resource: opts.resource,
      },
    ],
  };
}

/** Encode/decode the X-PAYMENT header (a base64 JSON of the signed delegation). */
export function encodePayment(signedDelegation: Delegation): string {
  return Buffer.from(JSON.stringify(signedDelegation)).toString('base64');
}
export function decodePayment(header: string): Delegation {
  return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Delegation;
}

/** The buyer's scoped payment delegation: lets `seller` pull up to `amount` of `asset`. */
export function buildPaymentDelegation(args: {
  buyer: Address;
  seller: Address;
  asset: Address;
  amount: bigint;
  environment: SmartAccountsEnvironment;
}): Delegation {
  return createDelegation({
    to: args.seller,
    from: args.buyer,
    environment: args.environment,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: args.asset, maxAmount: args.amount },
  } as Parameters<typeof createDelegation>[0]) as Delegation;
}

/** Pure: the seller's pre-redeem check that a payment matches what it asked for. */
export function verifyPayment(
  delegation: Delegation,
  req: PaymentRequirements,
): { ok: boolean; reason?: string } {
  if (delegation.delegate?.toLowerCase() !== req.payTo.toLowerCase()) {
    return { ok: false, reason: 'delegate is not the seller (payTo)' };
  }
  if (!delegation.signature || delegation.signature === '0x') {
    return { ok: false, reason: 'payment delegation is unsigned' };
  }
  // the Erc20TransferAmount caveat enforces the asset + maxAmount on-chain at redemption.
  return { ok: true };
}

/** Encode the seller's settlement: redeem the payment delegation to pull `amount` of `asset`. */
export function settlePaymentCalldata(
  signedDelegation: Delegation,
  asset: Address,
  seller: Address,
  amount: bigint,
): Hex {
  const execution = createExecution({
    target: asset,
    callData: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [seller, amount] }),
  });
  return contracts.DelegationManager.encode.redeemDelegations({
    delegations: [[signedDelegation]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  }) as Hex;
}
