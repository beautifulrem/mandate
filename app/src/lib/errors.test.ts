import { describe, expect, it } from 'vitest';
import { getDict } from './i18n';
import { humanizeError } from './errors';

const t = getDict('en');

describe('humanizeError', () => {
  it('maps a MetaMask rejection (the raw viem shape) to the friendly line', () => {
    expect(
      humanizeError('User rejected the request. Details: User rejected the request. Version: viem@2.51.3', t),
    ).toBe(t.errUserRejected);
    expect(humanizeError('MetaMask Tx Signature: User denied transaction signature.', t)).toBe(t.errUserRejected);
    expect(humanizeError('RPC error 4001: rejected by user', t)).toBe(t.errUserRejected);
  });

  it('strips viem Details / Version / Request Arguments noise from other errors', () => {
    expect(
      humanizeError('Insufficient funds for gas. Request Arguments: from: 0xabc Version: viem@2.51.3', t),
    ).toBe('Insufficient funds for gas.');
    expect(humanizeError('execution reverted. Details: 0xdeadbeef Version: viem@2.51.3', t)).toBe('execution reverted.');
  });

  it('keeps a plain message as-is, first line only, capped at 220 chars', () => {
    expect(humanizeError('orchestrator /config unavailable — is the service running?', t)).toBe(
      'orchestrator /config unavailable — is the service running?',
    );
    expect(humanizeError('first line\nsecond line', t)).toBe('first line');
    expect(humanizeError('x'.repeat(300), t)).toHaveLength(220);
  });
});
