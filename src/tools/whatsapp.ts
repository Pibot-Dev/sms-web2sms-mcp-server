import type { Config } from '../config.js';
import { WahaClient } from '../providers/waha/client.js';
import { findJob, getSender, type Job, type SeriesRecipient } from '../whatsapp/sender.js';

/** How long send_whatsapp waits for its message before returning the job id instead. */
const SINGLE_SEND_WAIT_MS = 90_000;

export const sendWhatsAppTool = {
  name: 'send_whatsapp',
  description:
    'Send one WhatsApp text via WAHA. Goes through the same paced queue as series (seen + typing + randomized gaps) to avoid account locking. Returns the result if sent within ~90s, otherwise a job_id for whatsapp_series_status.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      phone: {
        type: 'string',
        description: 'Recipient phone number in international format (e.g. +40712345678; 07XXXXXXXX is treated as Romanian)',
      },
      message: { type: 'string', description: 'Message text' },
      session: { type: 'string', description: 'WAHA session name (optional, defaults to WAHA_SESSION)' },
    },
    required: ['phone', 'message'],
  },
};

export const sendWhatsAppSeriesTool = {
  name: 'send_whatsapp_series',
  description:
    'Send WhatsApp messages to several recipients one after another (in series) via WAHA, with anti-ban pacing: number check, seen, typing simulation, randomized delay between recipients, hourly cap, and auto-stop on repeated failures. Returns a job_id immediately; poll whatsapp_series_status. Prefer personalized messages ({name} placeholder) over identical text.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      recipients: {
        type: 'array',
        description: 'Recipients, sent in order. Each may override the message.',
        items: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Phone number in international format' },
            name: { type: 'string', description: 'Used for the {name} placeholder' },
            message: { type: 'string', description: 'Per-recipient message (overrides template)' },
          },
          required: ['phone'],
        },
      },
      message: {
        type: 'string',
        description: 'Message template for recipients without their own message. Supports {name} and {phone}.',
      },
      session: { type: 'string', description: 'WAHA session name (optional, defaults to WAHA_SESSION)' },
    },
    required: ['recipients'],
  },
};

export const whatsAppSeriesStatusTool = {
  name: 'whatsapp_series_status',
  description: 'Get progress of a WhatsApp send job (per-recipient status, message ids, errors)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      job_id: { type: 'string', description: 'Job id returned by send_whatsapp or send_whatsapp_series' },
    },
    required: ['job_id'],
  },
};

export const cancelWhatsAppSeriesTool = {
  name: 'cancel_whatsapp_series',
  description: 'Cancel a queued or running WhatsApp send job. Messages already sent are not affected.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      job_id: { type: 'string', description: 'Job id to cancel' },
    },
    required: ['job_id'],
  },
};

function senderFor(args: Record<string, unknown>, config: Config) {
  const { waha } = config;
  const session = (args.session as string | undefined) || waha.session;
  const client = new WahaClient({ baseUrl: waha.baseUrl, apiKey: waha.apiKey, session });
  return getSender(client, waha.baseUrl, waha);
}

function summarize(job: Job) {
  const counts: Record<string, number> = {};
  for (const item of job.items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return {
    jobId: job.id,
    session: job.session,
    status: job.status,
    abortReason: job.abortReason,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    counts,
    items: job.items,
  };
}

function reply(data: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    ...(isError ? { isError: true } : {}),
  };
}

export async function handleSendWhatsApp(args: Record<string, unknown>, config: Config) {
  const sender = senderFor(args, config);
  const { job, done } = sender.enqueue([
    { phone: args.phone as string, message: args.message as string },
  ]);

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SINGLE_SEND_WAIT_MS);
  });
  const finished = await Promise.race([done, timeout]);
  clearTimeout(timer);

  if (!finished) {
    return reply({ success: true, queued: true, jobId: job.id, status: job.status });
  }

  const item = finished.items[0];
  if (item?.status === 'sent') {
    return reply({ success: true, jobId: job.id, messageId: item.messageId, chatId: item.chatId });
  }
  return reply(
    { success: false, jobId: job.id, status: item?.status, error: item?.error ?? finished.abortReason },
    true,
  );
}

export async function handleSendWhatsAppSeries(args: Record<string, unknown>, config: Config) {
  const recipients = args.recipients as SeriesRecipient[] | undefined;
  const template = args.message as string | undefined;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return reply({ success: false, error: 'recipients must be a non-empty array' }, true);
  }
  if (recipients.length > config.waha.maxSeriesSize) {
    return reply(
      {
        success: false,
        error: `Too many recipients (${recipients.length}); max per series is ${config.waha.maxSeriesSize} (WAHA_MAX_SERIES_SIZE)`,
      },
      true,
    );
  }

  const sender = senderFor(args, config);
  const { job } = sender.enqueue(recipients, template);
  const queued = job.items.filter((item) => item.status === 'queued').length;
  const { minDelayMs, maxDelayMs } = config.waha;

  return reply({
    success: true,
    jobId: job.id,
    queued,
    skipped: job.items.length - queued,
    estimatedMinutes: Math.ceil((queued * (minDelayMs + maxDelayMs)) / 2 / 60_000),
  });
}

export async function handleWhatsAppSeriesStatus(args: Record<string, unknown>) {
  const found = findJob(args.job_id as string);
  if (!found) return reply({ error: `Unknown job: ${args.job_id}` }, true);
  return reply(summarize(found.job));
}

export async function handleCancelWhatsAppSeries(args: Record<string, unknown>) {
  const found = findJob(args.job_id as string);
  if (!found) return reply({ error: `Unknown job: ${args.job_id}` }, true);
  const cancelled = found.sender.cancel(found.job.id);
  return reply({ jobId: found.job.id, cancelled, status: found.job.status });
}
