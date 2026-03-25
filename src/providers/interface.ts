import type { SendResult, StatusResult, BalanceResult } from '../types/sms.js';

export interface ISmsProvider {
  name: string;
  send(phone: string, message: string, sender?: string): Promise<SendResult>;
  checkStatus(messageId: string): Promise<StatusResult>;
  checkBalance(): Promise<BalanceResult>;
}

export type { SendResult, StatusResult, BalanceResult };
