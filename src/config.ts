export interface Config {
  apiKey: string;
  secret: string;
  sender: string;
  port: number;
  waha: {
    baseUrl: string;
    apiKey: string;
    session: string;
    minDelayMs: number;
    maxDelayMs: number;
    hourlyLimit: number;
    maxSeriesSize: number;
    maxConsecutiveFailures: number;
  };
}

function intEnv(name: string, fallback: number): number {
  const value = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function loadConfig(): Config {
  return {
    apiKey: process.env.WEB2SMS_API_KEY ?? '',
    secret: process.env.WEB2SMS_SECRET ?? '',
    sender: process.env.WEB2SMS_SENDER ?? '',
    port: parseInt(process.env.PORT ?? '3000', 10),
    waha: {
      baseUrl: process.env.WAHA_URL ?? 'http://localhost:3000',
      apiKey: process.env.WAHA_API_KEY ?? '',
      session: process.env.WAHA_SESSION || 'default',
      minDelayMs: intEnv('WAHA_MIN_DELAY_MS', 20_000),
      maxDelayMs: intEnv('WAHA_MAX_DELAY_MS', 60_000),
      hourlyLimit: Math.max(1, intEnv('WAHA_HOURLY_LIMIT', 40)),
      maxSeriesSize: Math.max(1, intEnv('WAHA_MAX_SERIES_SIZE', 50)),
      maxConsecutiveFailures: Math.max(1, intEnv('WAHA_MAX_CONSECUTIVE_FAILURES', 3)),
    },
  };
}

/**
 * Resolve credentials: per-request overrides take priority over env defaults.
 */
export function resolveCredentials(
  config: Config,
  requestApiKey?: string,
  requestSecret?: string,
): { apiKey: string; secret: string } {
  const apiKey = requestApiKey || config.apiKey;
  const secret = requestSecret || config.secret;

  if (!apiKey || !secret) {
    throw new Error(
      'Missing credentials: provide api_key/api_secret in the request or set WEB2SMS_API_KEY/WEB2SMS_SECRET environment variables.',
    );
  }

  return { apiKey, secret };
}
