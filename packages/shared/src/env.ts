import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

export type EnvSource = Record<string, string | undefined>;

export type MandateEnv = 'development' | 'test' | 'production';

export type MandateConfig = {
  mandateEnv: MandateEnv;
  rpcUrls: {
    baseSepolia?: string;
    baseMainnet?: string;
  };
  oneShot: {
    relayerRpcUrl?: string;
  };
  venice: {
    apiUrl?: string;
    model?: string;
    apiKey?: string;
  };
};

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requiredMandateEnv = z.preprocess(
  normalizeOptionalString,
  z.enum(['development', 'test', 'production']),
);
const optionalUrl = z.preprocess(normalizeOptionalString, z.string().url().optional());
const optionalSecret = z.preprocess(normalizeOptionalString, z.string().min(1).optional());

const envSchema = z
  .object({
    MANDATE_ENV: requiredMandateEnv,
    BASE_SEPOLIA_RPC_URL: optionalUrl,
    BASE_MAINNET_RPC_URL: optionalUrl,
    ONESHOT_RELAYER_RPC_URL: optionalUrl,
    VENICE_API_URL: optionalUrl,
    VENICE_MODEL: optionalSecret,
    VENICE_API_KEY: optionalSecret,
  })
  .passthrough();

export function loadEnv(source?: EnvSource): MandateConfig {
  const env = source ?? loadProcessEnv();
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${formatEnvError(parsed.error)}`);
  }

  return {
    mandateEnv: parsed.data.MANDATE_ENV,
    rpcUrls: compact({
      baseSepolia: parsed.data.BASE_SEPOLIA_RPC_URL,
      baseMainnet: parsed.data.BASE_MAINNET_RPC_URL,
    }),
    oneShot: compact({
      relayerRpcUrl: parsed.data.ONESHOT_RELAYER_RPC_URL,
    }),
    venice: compact({
      apiUrl: parsed.data.VENICE_API_URL,
      model: parsed.data.VENICE_MODEL,
      apiKey: parsed.data.VENICE_API_KEY,
    }),
  };
}

function loadProcessEnv(): EnvSource {
  loadDotenv();
  return process.env;
}

function compact<T extends Record<string, string | undefined>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [keyof T & string, string] => entry[1] !== undefined),
  ) as { [Key in keyof T as T[Key] extends string ? Key : never]: string };
}

function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}
