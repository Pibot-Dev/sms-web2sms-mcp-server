import type { ISmsProvider } from '../interface.js';
import type { SendResult, StatusResult, BalanceResult } from '../../types/sms.js';
import { generateSendSignature, generateBalanceSignature } from './auth.js';
import { getErrorInfo } from './errors.js';

const API_BASE = 'https://www.web2sms.ro';
const PREPAID_ENDPOINT = '/prepaid/message';
const SOAP_ENDPOINT = '/api';

interface Web2SmsConfig {
  apiKey: string;
  secret: string;
  sender?: string;
}

export class Web2SmsProvider implements ISmsProvider {
  readonly name = 'web2sms';
  private config: Web2SmsConfig;

  constructor(config: Web2SmsConfig) {
    this.config = config;
  }

  async send(phone: string, message: string, sender?: string): Promise<SendResult> {
    const senderValue = sender ?? this.config.sender ?? '';
    const nonce = String(Math.floor(Date.now() / 1000));

    const signature = generateSendSignature(
      this.config.apiKey,
      this.config.secret,
      nonce,
      senderValue,
      phone,
      message,
    );

    const payload = {
      apiKey: this.config.apiKey,
      sender: senderValue,
      recipient: phone,
      message,
      scheduleDatetime: '',
      validityDatetime: '',
      callbackUrl: '',
      userData: '',
      visibleMessage: '',
      nonce,
    };

    const authHeader = Buffer.from(`${this.config.apiKey}:${signature}`).toString('base64');

    const response = await fetch(`${API_BASE}${PREPAID_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`,
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json() as {
      id?: string;
      error?: { code?: number; message?: string };
    };

    const errorCode = body.error?.code ?? (response.ok ? 0 : -1);
    const errorInfo = getErrorInfo(errorCode);

    if (errorCode === 0) {
      return {
        success: true,
        messageId: body.id ?? 'unknown',
      };
    }

    return {
      success: false,
      error: body.error?.message ?? errorInfo.message,
      errorCode,
      retry: errorInfo.retry,
    };
  }

  async checkBalance(): Promise<BalanceResult> {
    const nonce = String(Math.floor(Date.now() / 1000));

    const signature = generateBalanceSignature(
      this.config.apiKey,
      this.config.secret,
      nonce,
    );

    const payload = {
      apiKey: this.config.apiKey,
      nonce,
    };

    const authHeader = Buffer.from(`${this.config.apiKey}:${signature}`).toString('base64');

    const response = await fetch(`${API_BASE}${PREPAID_ENDPOINT}`, {
      method: 'BALANCE' as string,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`,
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json() as {
      error?: { code?: number; message?: string };
    };

    const errorCode = body.error?.code ?? -1;

    if (errorCode === 0) {
      const credits = parseFloat(body.error?.message ?? '0');
      return { credits: isNaN(credits) ? 0 : credits };
    }

    const errorInfo = getErrorInfo(errorCode);
    return {
      credits: 0,
      error: body.error?.message ?? errorInfo.message,
    };
  }

  async checkStatus(messageId: string): Promise<StatusResult> {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="https://www.web2sms.ro/api">
  <soapenv:Header/>
  <soapenv:Body>
    <web:checkStatus>
      <web:apiKey>${this.escapeXml(this.config.apiKey)}</web:apiKey>
      <web:secret>${this.escapeXml(this.config.secret)}</web:secret>
      <web:messageId>${this.escapeXml(messageId)}</web:messageId>
    </web:checkStatus>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(`${API_BASE}${SOAP_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'checkStatus',
      },
      body: soapBody,
    });

    const xml = await response.text();

    const statusMatch = xml.match(/<status[^>]*>(.*?)<\/status>/s);
    const costMatch = xml.match(/<cost[^>]*>(.*?)<\/cost>/s);
    const descMatch = xml.match(/<statusDescription[^>]*>(.*?)<\/statusDescription>/s);

    const statusCode = statusMatch ? parseInt(statusMatch[1].trim(), 10) : -1;

    const statusMap: Record<number, StatusResult['status']> = {
      0: 'pending',
      1: 'sent',
      2: 'delivered',
      3: 'failed',
    };

    return {
      messageId,
      status: statusMap[statusCode] ?? 'unknown',
      statusCode,
      cost: costMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim(),
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
