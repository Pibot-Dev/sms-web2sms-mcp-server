export interface ErrorInfo {
  message: string;
  retry: boolean;
}

export const ERROR_CODES: Map<number, ErrorInfo> = new Map([
  [0, { message: 'OK — Success', retry: false }],
  [268435457, { message: 'AUTH_REQUIRED — Invalid authentication or account disabled', retry: false }],
  [268435458, { message: 'INVALID_MSISDN / NOT_IMPLEMENTED — Invalid phone number or method not supported', retry: false }],
  [268435459, { message: 'INVALID_REQUEST_DATA — Check request parameters (nonce, API key, signature, message)', retry: false }],
  [268435460, { message: 'OVERLIMIT — Message limit exceeded. Contact provider.', retry: false }],
  [268435462, { message: 'INVALID_ACCOUNT_TYPE — Contact provider.', retry: false }],
  [268435463, { message: 'ACCOUNT_DISABLED — Account is closed or prepaid disabled', retry: false }],
  [268435464, { message: 'FAILED_CREATE_SMS_SENDER — Contact provider for reconfiguration.', retry: false }],
  [268435465, { message: 'REGISTER_SMS — Could not save message to database.', retry: false }],
  [268435466, { message: 'BLACK_LISTED — Recipient number is blacklisted.', retry: false }],
  [268435471, { message: 'OUTSIDE_LIMIT — Message outside configured account limits.', retry: true }],
  [268435472, { message: 'INVALID_PARAMETER — Check request parameters.', retry: false }],
  [268435473, { message: 'INVALID_MSGID — Invalid message ID.', retry: false }],
  [268435474, { message: 'REQUEST_LIMIT_EXCEEDED — Too many concurrent requests.', retry: true }],
  [268435475, { message: 'VALIDITY_ERROR — Check schedule/validity parameters.', retry: false }],
  [268435476, { message: 'DUPLICATE_ENTRY — Anti-spam filter triggered. Message already sent.', retry: false }],
  [268435520, { message: 'NO_VCN_OR_SENDER — Account misconfigured. Contact provider.', retry: false }],
  [268435584, { message: 'INTERNAL_ERROR — Contact provider.', retry: false }],
  [268435712, { message: 'MESSAGE_NOT_ALLOWED — Message content blocked by operators.', retry: false }],
  [268435968, { message: 'OUTSIDE_TIME_LIMIT — Message outside allowed time window.', retry: true }],
  [1073741825, { message: 'MAINTENANCE — System under maintenance.', retry: true }],
]);

export function getErrorInfo(code: number): ErrorInfo {
  return ERROR_CODES.get(code) ?? { message: `UNKNOWN_ERROR (${code})`, retry: false };
}
