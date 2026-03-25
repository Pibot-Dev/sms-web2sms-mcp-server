export interface Config {
  apiKey: string;
  secret: string;
  sender: string;
  port: number;
}

export function loadConfig(): Config {
  return {
    apiKey: process.env.WEB2SMS_API_KEY ?? '',
    secret: process.env.WEB2SMS_SECRET ?? '',
    sender: process.env.WEB2SMS_SENDER ?? '',
    port: parseInt(process.env.PORT ?? '3000', 10),
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
