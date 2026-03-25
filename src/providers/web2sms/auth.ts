import { createHash } from 'node:crypto';

/**
 * Generate SHA-512 signature for web2sms.ro API requests.
 * 
 * For SEND (POST): sha512(apiKey + nonce + "POST" + "/prepaid/message" + sender + recipient + message + visibleMessage + scheduleDatetime + validityDatetime + callbackUrl + secret)
 * For BALANCE: sha512(apiKey + nonce + "BALANCE" + "/prepaid/message" + secret)
 */
export function generateSignature(parts: string[]): string {
  const stringToHash = parts.join('');
  return createHash('sha512').update(stringToHash, 'utf8').digest('hex');
}

export function generateSendSignature(
  apiKey: string,
  secret: string,
  nonce: string,
  sender: string,
  recipient: string,
  message: string,
  visibleMessage = '',
  scheduleDatetime = '',
  validityDatetime = '',
  callbackUrl = '',
): string {
  return generateSignature([
    apiKey, nonce, 'POST', '/prepaid/message',
    sender, recipient, message,
    visibleMessage, scheduleDatetime, validityDatetime, callbackUrl,
    secret,
  ]);
}

export function generateBalanceSignature(
  apiKey: string,
  secret: string,
  nonce: string,
): string {
  return generateSignature([apiKey, nonce, 'BALANCE', '/prepaid/message', secret]);
}
