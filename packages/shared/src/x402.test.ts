import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import type { Address } from 'viem';
import { describe, expect, it } from 'vitest';
import type { Delegation } from './delegation.js';
import {
  build402,
  buildPaymentDelegation,
  decodePayment,
  encodePayment,
  settlePaymentCalldata,
  verifyPayment,
} from './x402.js';

const ENV = getSmartAccountsEnvironment(84532);
const ASSET: Address = '0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55';
const SELLER: Address = '0x31f898937F29c089b748750b00668Cf8ED5a5F28';
const BUYER: Address = '0x2caa4D4583015F418F2d962e2E38F7D5E724d16e';

describe('build402', () => {
  it('builds an erc7710 payment-required body', () => {
    const body = build402({ asset: ASSET, payTo: SELLER, amount: 1_000_000n, chainId: 84532, resource: 'proposal-context/42' });
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0]).toMatchObject({
      scheme: 'erc7710',
      network: 'eip155:84532',
      asset: ASSET,
      payTo: SELLER,
      maxAmountRequired: '1000000',
      resource: 'proposal-context/42',
    });
  });
});

describe('encode/decodePayment', () => {
  it('round-trips a signed delegation through the X-PAYMENT header', () => {
    const del = buildPaymentDelegation({ buyer: BUYER, seller: SELLER, asset: ASSET, amount: 1n, environment: ENV });
    const signed: Delegation = { ...del, signature: '0xabcdef' };
    expect(decodePayment(encodePayment(signed))).toEqual(signed);
  });
});

describe('buildPaymentDelegation', () => {
  it('delegates seller→pull, with caveats (Erc20TransferAmount)', () => {
    const del = buildPaymentDelegation({ buyer: BUYER, seller: SELLER, asset: ASSET, amount: 1n, environment: ENV });
    expect(del.delegator).toBe(BUYER);
    expect(del.delegate).toBe(SELLER);
    expect(del.caveats.length).toBeGreaterThan(0);
    expect(del.signature).toBe('0x');
  });
});

describe('verifyPayment', () => {
  const req = { scheme: 'erc7710' as const, network: 'eip155:84532', asset: ASSET, payTo: SELLER, maxAmountRequired: '1', resource: 'r' };
  const base = buildPaymentDelegation({ buyer: BUYER, seller: SELLER, asset: ASSET, amount: 1n, environment: ENV });

  it('accepts a signed delegation to the seller', () => {
    expect(verifyPayment({ ...base, signature: '0xsig' }, req).ok).toBe(true);
  });
  it('rejects an unsigned payment', () => {
    expect(verifyPayment(base, req)).toEqual({ ok: false, reason: 'payment delegation is unsigned' });
  });
  it('rejects a payment that pays the wrong party', () => {
    const wrong = buildPaymentDelegation({ buyer: BUYER, seller: BUYER, asset: ASSET, amount: 1n, environment: ENV });
    expect(verifyPayment({ ...wrong, signature: '0xsig' }, req).ok).toBe(false);
  });
});

describe('settlePaymentCalldata', () => {
  it('encodes a redeemDelegations that pulls the payment', () => {
    const signed: Delegation = { ...buildPaymentDelegation({ buyer: BUYER, seller: SELLER, asset: ASSET, amount: 1n, environment: ENV }), signature: `0x${'cd'.repeat(65)}` };
    const data = settlePaymentCalldata(signed, ASSET, SELLER, 1n);
    expect(data).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(data.length).toBeGreaterThan(200);
  });
});
