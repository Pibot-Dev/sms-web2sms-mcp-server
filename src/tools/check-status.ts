import type { Config } from '../config.js';
import { resolveCredentials } from '../config.js';
import { createProvider } from '../providers/index.js';

export const checkStatusTool = {
  name: 'check_status',
  description: 'Check SMS delivery status via web2sms.ro SOAP API',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message_id: {
        type: 'string',
        description: 'Message ID returned by send_sms',
      },
      api_key: {
        type: 'string',
        description: 'Override web2sms.ro API key (optional)',
      },
      api_secret: {
        type: 'string',
        description: 'Override web2sms.ro API secret (optional)',
      },
    },
    required: ['message_id'],
  },
};

export async function handleCheckStatus(
  args: Record<string, unknown>,
  config: Config,
) {
  const messageId = args.message_id as string;
  const { apiKey, secret } = resolveCredentials(
    config,
    args.api_key as string | undefined,
    args.api_secret as string | undefined,
  );

  const provider = createProvider(apiKey, secret);
  const result = await provider.checkStatus(messageId);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          messageId: result.messageId,
          status: result.status,
          statusCode: result.statusCode,
          cost: result.cost,
          description: result.description,
        }),
      },
    ],
  };
}
