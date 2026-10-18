/**
 * Minimal client for WAHA (WhatsApp HTTP API) — https://waha.devlike.pro
 *
 * Only the endpoints needed for human-like sending are wrapped:
 * session status, number check, seen, typing and text messages.
 */

export interface WahaConfig {
  baseUrl: string;
  apiKey?: string;
  session: string;
}

export interface WahaSendResult {
  success: boolean;
  messageId?: string;
  chatId?: string;
  error?: string;
  statusCode?: number;
  retry?: boolean;
}

export class WahaError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }

  /** 429 and 5xx are transient; 4xx means the request itself is wrong. */
  get retry(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500 || this.statusCode === 0;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export class WahaClient {
  readonly name = 'waha';
  private config: WahaConfig;

  constructor(config: WahaConfig) {
    this.config = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, '') };
  }

  get session(): string {
    return this.config.session;
  }

  /** Returns the WAHA session status (WORKING, SCAN_QR_CODE, FAILED, ...). */
  async getSessionStatus(): Promise<string> {
    const body = await this.request<{ status?: string }>(
      'GET',
      `/api/sessions/${encodeURIComponent(this.config.session)}`,
    );
    return body.status ?? 'UNKNOWN';
  }

  /** Resolve a phone number to a WhatsApp chat id, or null if it has no account. */
  async checkExists(phone: string): Promise<string | null> {
    const query = new URLSearchParams({ phone, session: this.config.session });
    const body = await this.request<{ numberExists?: boolean; chatId?: string }>(
      'GET',
      `/api/contacts/check-exists?${query}`,
    );
    if (!body.numberExists) return null;
    return body.chatId ?? `${phone}@c.us`;
  }

  async sendSeen(chatId: string): Promise<void> {
    await this.request('POST', '/api/sendSeen', { session: this.config.session, chatId });
  }

  async startTyping(chatId: string): Promise<void> {
    await this.request('POST', '/api/startTyping', { session: this.config.session, chatId });
  }

  async stopTyping(chatId: string): Promise<void> {
    await this.request('POST', '/api/stopTyping', { session: this.config.session, chatId });
  }

  async sendText(chatId: string, text: string, linkPreview = false): Promise<string> {
    const body = await this.request<{ id?: string | { _serialized?: string }; key?: { id?: string } }>(
      'POST',
      '/api/sendText',
      { session: this.config.session, chatId, text, linkPreview },
    );
    if (typeof body.id === 'string') return body.id;
    return body.id?._serialized ?? body.key?.id ?? 'unknown';
  }

  private async request<T = unknown>(method: string, path: string, payload?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    if (this.config.apiKey) headers['X-Api-Key'] = this.config.apiKey;

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new WahaError(`WAHA unreachable: ${(error as Error).message}`, 0);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new WahaError(`WAHA ${method} ${path.split('?')[0]} failed (${response.status}): ${text.slice(0, 300)}`, response.status);
    }

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }
}
