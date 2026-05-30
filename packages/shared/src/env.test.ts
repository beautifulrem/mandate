import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('parses a valid sample env object', () => {
    expect(
      loadEnv({
        MANDATE_ENV: 'test',
        BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.example/rpc',
        BASE_MAINNET_RPC_URL: '',
        ONESHOT_RELAYER_RPC_URL: 'https://relayer.example/rpc',
        VENICE_API_URL: 'https://api.venice.ai/api/v1',
        VENICE_MODEL: 'tee-qwen3-5-122b-a10b',
      }),
    ).toEqual({
      mandateEnv: 'test',
      rpcUrls: {
        baseSepolia: 'https://sepolia.base.example/rpc',
      },
      oneShot: {
        relayerRpcUrl: 'https://relayer.example/rpc',
      },
      venice: {
        apiUrl: 'https://api.venice.ai/api/v1',
        model: 'tee-qwen3-5-122b-a10b',
      },
    });
  });

  it('does not require lazy RPC or provider settings', () => {
    expect(loadEnv({ MANDATE_ENV: 'development' })).toEqual({
      mandateEnv: 'development',
      rpcUrls: {},
      oneShot: {},
      venice: {},
    });
  });

  it('throws a clear error when a required env var is missing', () => {
    expect(() => loadEnv({})).toThrow(/MANDATE_ENV/);
  });
});
