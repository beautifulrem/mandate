import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  b64ToBytes,
  buildSend7710Params,
  canonicalJson,
  floorFee,
  is7702Upgraded,
  isTerminalStatus,
  pickPaymentToken,
  relayStatusLabel,
  verifyRelayerWebhook,
  verifyWebhookSignature,
  type CapabilitiesResult,
  type Ed25519Jwk,
  type RelayerWebhookEvent,
} from './oneshot.js';

describe('relay status', () => {
  it('labels the status codes', () => {
    expect(relayStatusLabel(100)).toBe('Pending');
    expect(relayStatusLabel(200)).toBe('Confirmed');
    expect(relayStatusLabel(500)).toBe('Reverted');
  });
  it('treats Confirmed/Rejected/Reverted as terminal only', () => {
    expect([200, 400, 500].map(isTerminalStatus)).toEqual([true, true, true]);
    expect([100, 110].map(isTerminalStatus)).toEqual([false, false]);
  });
});

describe('pickPaymentToken', () => {
  const caps: CapabilitiesResult = {
    '8453': {
      feeCollector: '0xE936e8FAf4A5655469182A49a505055B71C17604',
      targetAddress: '0x26a529124f0bbf9af9d8f9f84a43efe47cf1199a',
      tokens: [
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: '6' },
        { address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', symbol: 'USDT', decimals: '6' },
      ],
    },
  };
  it('finds a token by symbol (case-insensitive)', () => {
    expect(pickPaymentToken(caps, 8453, 'usdc').address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });
  it('throws for an unsupported chain or token', () => {
    expect(() => pickPaymentToken(caps, 84532, 'USDC')).toThrow(/does not support chain/);
    expect(() => pickPaymentToken(caps, 8453, 'DAI')).toThrow(/does not accept DAI/);
  });
});

describe('floorFee', () => {
  it('returns the larger of the converted fee and the floor', () => {
    expect(floorFee(100n, 250n)).toBe(250n);
    expect(floorFee(400n, 250n)).toBe(400n);
  });
});

describe('is7702Upgraded', () => {
  it('detects the EIP-7702 delegation indicator', () => {
    expect(is7702Upgraded('0xef0100aabbccddeeff00112233445566778899aabb')).toBe(true);
    expect(is7702Upgraded('0x')).toBe(false);
    expect(is7702Upgraded(null)).toBe(false);
    expect(is7702Upgraded('0x6080604052')).toBe(false);
  });
});

describe('buildSend7710Params', () => {
  const exec = { target: '0xToken' as `0x${string}`, value: '0', data: '0xdeadbeef' as `0x${string}` };
  it('wraps a single permission context + executions, omitting authorizationList by default', () => {
    const p = buildSend7710Params({ chainId: 8453, permissionContext: [{ d: 1 }], executions: [exec] });
    expect(p.chainId).toBe('8453');
    expect('authorizationList' in p).toBe(false);
    expect(p.transactions).toEqual([{ permissionContext: [{ d: 1 }], executions: [exec] }]);
  });
  it('includes the EIP-7702 authorizationList on first use', () => {
    const p = buildSend7710Params({ chainId: 8453, permissionContext: [], executions: [exec], authorizationList: [{ a: 1 }] });
    expect(p.authorizationList).toEqual([{ a: 1 }]);
  });
  it('carries destinationUrl + memo for webhook status delivery, omitted when unset', () => {
    const p = buildSend7710Params({
      chainId: 8453,
      permissionContext: [],
      executions: [exec],
      destinationUrl: 'https://example.com/webhooks/1shot',
      memo: 'run_42',
    });
    expect(p.destinationUrl).toBe('https://example.com/webhooks/1shot');
    expect(p.memo).toBe('run_42');
    const bare = buildSend7710Params({ chainId: 8453, permissionContext: [], executions: [exec] });
    expect('destinationUrl' in bare).toBe(false);
    expect('memo' in bare).toBe(false);
  });
});

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,1]},"b":1}');
  });
  it('drops undefined entries and serializes primitives like JSON', () => {
    expect(canonicalJson({ b: undefined, a: null })).toBe('{"a":null}');
    expect(canonicalJson('s')).toBe('"s"');
    expect(canonicalJson(7)).toBe('7');
  });
});

describe('b64ToBytes', () => {
  it('decodes standard and url-safe base64 identically', () => {
    const std = Buffer.from([251, 239, 190]).toString('base64'); // '++++' style chars
    const url = std.replace(/\+/g, '-').replace(/\//g, '_');
    expect([...b64ToBytes(std)]).toEqual([251, 239, 190]);
    expect([...b64ToBytes(url)]).toEqual([251, 239, 190]);
  });
});

describe('verifyRelayerWebhook (full event, canonical form)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as unknown as Ed25519Jwk), kid: 'k1' };
  const unsigned = { type: 0, keyId: 'k1', data: { status: 200, hash: '0xabc' } };
  const signature = crypto.sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString('base64');
  const event = { ...unsigned, signature } as RelayerWebhookEvent;

  it('accepts a correctly signed event, keyed by keyId', async () => {
    expect(await verifyRelayerWebhook(event, { keys: [jwk] })).toBe(true);
  });
  it('rejects a tampered event', async () => {
    expect(await verifyRelayerWebhook({ ...event, type: 1 }, { keys: [jwk] })).toBe(false);
  });
  it('rejects when the keyId is unknown or the signature is missing', async () => {
    expect(await verifyRelayerWebhook({ ...event, keyId: 'nope' }, { keys: [jwk] })).toBe(false);
    expect(await verifyRelayerWebhook({ ...unsigned } as RelayerWebhookEvent, { keys: [jwk] })).toBe(false);
  });
});

describe('verifyWebhookSignature (Ed25519)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as unknown as Ed25519Jwk;
  const payload = JSON.stringify({ taskId: '0xabc', status: 200 });
  const sig = crypto.sign(null, Buffer.from(payload), privateKey);

  it('accepts a valid signature', async () => {
    expect(await verifyWebhookSignature(payload, sig, jwk)).toBe(true);
  });
  it('rejects a tampered payload', async () => {
    expect(await verifyWebhookSignature(payload + ' ', sig, jwk)).toBe(false);
  });
  it('rejects a signature from a different key', async () => {
    const other = crypto.generateKeyPairSync('ed25519');
    const otherJwk = other.publicKey.export({ format: 'jwk' }) as unknown as Ed25519Jwk;
    expect(await verifyWebhookSignature(payload, sig, otherJwk)).toBe(false);
  });
});
