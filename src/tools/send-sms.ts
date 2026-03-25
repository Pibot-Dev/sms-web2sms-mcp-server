import type { Config } from '../config.js';
import { resolveCredentials } from '../config.js';
import { createProvider } from '../providers/index.js';

export const sendSmsTool = {
  name: 'send_sms',
  description: 'Send an SMS message via web2sms.ro Romanian SMS gateway',
  inputSchema: {
    type: 'object' as const,
    properties: {
      phone: {
        type: 'string',
        description: 'Recipient phone number (Romanian format: 07XXXXXXXX or +407XXXXXXXX)',
      },
      message: {
        type: 'string',
        description: 'SMS message body',
      },
      sender: {
        type: 'string',
        description: 'Custom sender ID (optional, uses default from config if not provided)',
      },
      api_key: {
        type: 'string',
        description: 'Override web2sms.ro API key (optional, uses WEB2SMS_API_KEY env var if not provided)',
      },
      api_secret: {
        type: 'string',
        description: 'Override web2sms.ro API secret (optional, uses WEB2SMS_SECRET env var if not provided)',
      },
    },
    required: ['phone', 'message'],
  },
};

export async function handleSendSms(
  args: Record<string, unknown>,
  config: Config,
) {
  const phone = args.phone as string;
  const message = args.message as string;
  const sender = (args.sender as string | undefined) ?? config.sender;
  const { apiKey, secret } = resolveCredentials(
    config,
    args.api_key as string | undefined,
    args.api_secret as string | undefined,
  );

  const provider = createProvider(apiKey, secret, sender);
  const result = await provider.send(phone, message, sender);

  if (result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            messageId: result.messageId,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          retry: result.retry,
        }),
      },
    ],
    isError: true,
  };
}
