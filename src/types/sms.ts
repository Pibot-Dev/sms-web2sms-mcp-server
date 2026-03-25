export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
  retry?: boolean;
}

export interface StatusResult {
  messageId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'unknown';
  statusCode: number;
  cost?: string;
  description?: string;
}

export interface BalanceResult {
  credits: number;
  error?: string;
}
