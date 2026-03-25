import type { Config } from '../config.js';
import { resolveCredentials } from '../config.js';
import { createProvider } from '../providers/index.js';

export const checkBalanceTool = {
  name: 'check_balance',
  description: 'Check prepaid SMS credit balance on web2sms.ro',
  inputSchema: {
    type: 'object' as const,
    properties: {
      api_key: {
        type: 'string',
        description: 'Override web2sms.ro API key (optional)',
      },
      api_secret: {
        type: 'string',
        description: 'Override web2sms.ro API secret (optional)',
      },
    },
    required: [],
  },
};

export async function handleCheckBalance(
  args: Record<string, unknown>,
  config: Config,
) {
  const { apiKey, secret } = resolveCredentials(
    config,
    args.api_key as string | undefined,
    args.api_secret as string | undefined,
  );

  const provider = createProvider(apiKey, secret);
  const result = await provider.checkBalance();

  if (result.error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            credits: result.credits,
            error: result.error,
          }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          credits: result.credits,
        }),
      },
    ],
  };
}
