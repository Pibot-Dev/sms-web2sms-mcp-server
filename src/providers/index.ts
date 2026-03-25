import type { ISmsProvider } from './interface.js';
import { Web2SmsProvider } from './web2sms/client.js';

export function createProvider(
  apiKey: string,
  secret: string,
  sender?: string,
): ISmsProvider {
  return new Web2SmsProvider({ apiKey, secret, sender });
}

export { Web2SmsProvider } from './web2sms/client.js';
export type { ISmsProvider } from './interface.js';
