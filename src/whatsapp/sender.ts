import { randomUUID } from 'node:crypto';
import { WahaClient, WahaError } from '../providers/waha/client.js';
import { normalizeWhatsAppPhone } from './phone.js';

/**
 * Anti-ban WhatsApp sender for WAHA.
 *
 * Messages for one WAHA session go out strictly one at a time ("in series")
 * through a promise chain — no mutexes, nothing blocks the event loop, and
 * MCP tool calls return as soon as a job is queued. Every message mimics a
 * human: check the number exists, mark the chat as seen, type for a time
 * proportional to the text, then send. Between recipients a randomized gap
 * is enforced and an hourly cap is applied, which keeps the account away
 * from WhatsApp's automated-behaviour detection that locks numbers.
 */

export interface PacingConfig {
  minDelayMs: number;
  maxDelayMs: number;
  hourlyLimit: number;
  maxConsecutiveFailures: number;
}

export interface SeriesRecipient {
  phone: string;
  name?: string;
  message?: string;
}

export type ItemStatus = 'queued' | 'sent' | 'failed' | 'skipped' | 'cancelled';

export interface JobItem {
  phone: string;
  chatId?: string;
  status: ItemStatus;
  messageId?: string;
  error?: string;
  sentAt?: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'aborted' | 'cancelled';

export interface Job {
  id: string;
  session: string;
  status: JobStatus;
  createdAt: string;
  finishedAt?: string;
  abortReason?: string;
  items: JobItem[];
}

interface PendingItem {
  item: JobItem;
  text: string;
}

const MAX_RETAINED_JOBS = 100;
const HOUR_MS = 60 * 60 * 1000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const randomBetween = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);

/** Typing time scales with message length (~ a fast human), with jitter, clamped to 1.5–8s. */
function typingDurationMs(text: string): number {
  const base = text.length * 45;
  return Math.round(Math.min(8000, Math.max(1500, base * randomBetween(0.8, 1.2))));
}

/** Fill {name} / {phone} placeholders so every recipient gets distinct content. */
export function renderTemplate(template: string, recipient: SeriesRecipient): string {
  return template
    .replace(/\{name\}/g, recipient.name ?? '')
    .replace(/\{phone\}/g, recipient.phone)
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export class WhatsAppSender {
  private tail: Promise<void> = Promise.resolve();
  private lastSentAt = 0;
  private sentTimestamps: number[] = [];
  private jobs = new Map<string, Job>();
  private cancelled = new Set<string>();

  constructor(
    private client: WahaClient,
    private pacing: PacingConfig,
  ) {}

  /** Queue a job; returns immediately with the job and a promise for its completion. */
  enqueue(recipients: SeriesRecipient[], template?: string): { job: Job; done: Promise<Job> } {
    const job: Job = {
      id: randomUUID(),
      session: this.client.session,
      status: 'queued',
      createdAt: new Date().toISOString(),
      items: [],
    };

    const pending: PendingItem[] = [];
    const seen = new Set<string>();
    for (const recipient of recipients) {
      const text = recipient.message ?? (template ? renderTemplate(template, recipient) : '');
      let phone: string;
      try {
        phone = normalizeWhatsAppPhone(recipient.phone);
      } catch (error) {
        job.items.push({ phone: recipient.phone, status: 'skipped', error: (error as Error).message });
        continue;
      }
      if (seen.has(phone)) {
        job.items.push({ phone, status: 'skipped', error: 'Duplicate recipient' });
        continue;
      }
      seen.add(phone);
      if (!text) {
        job.items.push({ phone, status: 'skipped', error: 'Empty message' });
        continue;
      }
      const item: JobItem = { phone, status: 'queued' };
      job.items.push(item);
      pending.push({ item, text });
    }

    this.remember(job);

    const done = new Promise<Job>((resolve) => {
      this.tail = this.tail
        .then(() => this.run(job, pending))
        .catch((error) => this.finish(job, pending, 'aborted', (error as Error).message))
        .finally(() => {
          job.finishedAt ??= new Date().toISOString();
          this.cancelled.delete(job.id);
          resolve(job);
        });
    });

    return { job, done };
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status === 'completed' || job.status === 'aborted' || job.status === 'cancelled') {
      return false;
    }
    this.cancelled.add(id);
    return true;
  }

  private async run(job: Job, pending: PendingItem[]): Promise<void> {
    if (this.cancelled.has(job.id)) {
      this.finish(job, pending, 'cancelled');
      return;
    }
    job.status = 'running';

    if (pending.length > 0) {
      const sessionStatus = await this.client.getSessionStatus();
      if (sessionStatus !== 'WORKING') {
        this.finish(job, pending, 'aborted', `WAHA session "${job.session}" is ${sessionStatus}, expected WORKING`);
        return;
      }
    }

    let consecutiveFailures = 0;
    for (let i = 0; i < pending.length; i++) {
      if (this.cancelled.has(job.id)) {
        this.finish(job, pending.slice(i), 'cancelled');
        return;
      }

      await this.waitForSlot();
      if (this.cancelled.has(job.id)) {
        this.finish(job, pending.slice(i), 'cancelled');
        return;
      }

      const { item, text } = pending[i];
      await this.sendOne(item, text);

      if (item.status === 'failed') {
        consecutiveFailures++;
        if (consecutiveFailures >= this.pacing.maxConsecutiveFailures) {
          this.finish(
            job,
            pending.slice(i + 1),
            'aborted',
            `${consecutiveFailures} consecutive failures — stopped to protect the account`,
          );
          return;
        }
      } else {
        consecutiveFailures = 0;
      }
    }

    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
  }

  private async sendOne(item: JobItem, text: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        const chatId = item.chatId ?? (await this.client.checkExists(item.phone));
        if (!chatId) {
          item.status = 'skipped';
          item.error = 'Number is not on WhatsApp';
          return;
        }
        item.chatId = chatId;

        // Presence signals are best-effort: not every WAHA engine supports them.
        await this.client.sendSeen(chatId).catch(() => undefined);
        await sleep(randomBetween(500, 1500));
        const typing = await this.client.startTyping(chatId).then(() => true, () => false);
        await sleep(typingDurationMs(text));
        if (typing) await this.client.stopTyping(chatId).catch(() => undefined);

        item.messageId = await this.client.sendText(chatId, text);
        item.status = 'sent';
        item.sentAt = new Date().toISOString();
        item.error = undefined;
        this.recordSend();
        return;
      } catch (error) {
        const retry = error instanceof WahaError && error.retry && attempt < MAX_RETRIES;
        item.error = (error as Error).message;
        if (!retry) {
          item.status = 'failed';
          // Count failed attempts too, so errors never speed up the pace.
          this.lastSentAt = Date.now();
          return;
        }
        // Back off harder on rate limiting.
        const status = (error as WahaError).statusCode;
        await sleep((status === 429 ? 60_000 : 5_000) * 2 ** attempt);
      }
    }
  }

  /** Wait for the randomized inter-message gap and the hourly cap. */
  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.sentTimestamps = this.sentTimestamps.filter((t) => now - t < HOUR_MS);

      if (this.sentTimestamps.length >= this.pacing.hourlyLimit) {
        await sleep(this.sentTimestamps[0] + HOUR_MS - now + 1000);
        continue;
      }

      if (this.lastSentAt > 0) {
        const gap = randomBetween(this.pacing.minDelayMs, this.pacing.maxDelayMs);
        const wait = this.lastSentAt + gap - now;
        if (wait > 0) await sleep(wait);
      }
      return;
    }
  }

  private recordSend(): void {
    this.lastSentAt = Date.now();
    this.sentTimestamps.push(this.lastSentAt);
  }

  private finish(job: Job, remaining: PendingItem[], status: JobStatus, reason?: string): void {
    for (const { item } of remaining) {
      if (item.status === 'queued') item.status = 'cancelled';
    }
    job.status = status;
    job.abortReason = reason;
    job.finishedAt = new Date().toISOString();
  }

  private remember(job: Job): void {
    this.jobs.set(job.id, job);
    if (this.jobs.size <= MAX_RETAINED_JOBS) return;
    for (const [id, old] of this.jobs) {
      if (this.jobs.size <= MAX_RETAINED_JOBS) break;
      if (old.status !== 'queued' && old.status !== 'running') this.jobs.delete(id);
    }
  }
}

const senders = new Map<string, WhatsAppSender>();

/** One sender per WAHA instance + session, so all callers share the same queue and pacing. */
export function getSender(client: WahaClient, baseUrl: string, pacing: PacingConfig): WhatsAppSender {
  const key = `${baseUrl}|${client.session}`;
  let sender = senders.get(key);
  if (!sender) {
    sender = new WhatsAppSender(client, pacing);
    senders.set(key, sender);
  }
  return sender;
}

export function findJob(id: string): { sender: WhatsAppSender; job: Job } | undefined {
  for (const sender of senders.values()) {
    const job = sender.getJob(id);
    if (job) return { sender, job };
  }
  return undefined;
}
