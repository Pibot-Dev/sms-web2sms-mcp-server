# sms-web2sms-mcp-server

MCP (Model Context Protocol) server for sending SMS via [web2sms.ro](https://www.web2sms.ro) Romanian SMS gateway.

## Features

- **send_sms** — Send SMS messages to Romanian phone numbers
- **check_status** — Check delivery status of sent messages
- **check_balance** — Check prepaid credit balance
- Per-request credential overrides (or use environment defaults)
- SHA-512 HMAC authentication
- Full error code mapping with retry hints
- **WhatsApp via [WAHA](https://waha.devlike.pro)** — single and series sending with anti-ban pacing

## Quick Start

### With Claude Desktop / MCP Client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "web2sms": {
      "command": "node",
      "args": ["/path/to/sms-web2sms-mcp-server/dist/index.js"],
      "env": {
        "WEB2SMS_API_KEY": "your-api-key",
        "WEB2SMS_SECRET": "your-secret"
      }
    }
  }
}
```

### Manual

```bash
git clone https://github.com/Pibot-Dev/sms-web2sms-mcp-server.git
cd sms-web2sms-mcp-server
npm install
npm run build
```

### Docker

```bash
docker build -t sms-web2sms-mcp .
docker run -e WEB2SMS_API_KEY=xxx -e WEB2SMS_SECRET=yyy sms-web2sms-mcp
```

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `WEB2SMS_API_KEY` | Yes* | API key from web2sms.ro dashboard |
| `WEB2SMS_SECRET` | Yes* | API secret from web2sms.ro dashboard |
| `WEB2SMS_SENDER` | No | Default sender ID |
| `PORT` | No | Server port (default: 3000) |

\* Can be provided per-request via `api_key`/`api_secret` parameters instead.

## Tools

### send_sms

Send an SMS message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Yes | Recipient number (07XXXXXXXX or +407XXXXXXXX) |
| `message` | string | Yes | SMS body |
| `sender` | string | No | Custom sender ID |
| `api_key` | string | No | Override API key |
| `api_secret` | string | No | Override API secret |

### check_status

Check delivery status of a sent message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | Message ID from send_sms |
| `api_key` | string | No | Override API key |
| `api_secret` | string | No | Override API secret |

Status values: `pending`, `sent`, `delivered`, `failed`, `unknown`

### check_balance

Check prepaid credit balance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_key` | string | No | Override API key |
| `api_secret` | string | No | Override API secret |

### send_whatsapp

Send one WhatsApp text through WAHA. It goes through the same paced queue as a series. Returns the message id if it is sent within ~90s, otherwise a `jobId`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Yes | International number (`+40712345678`; `07XXXXXXXX` is treated as Romanian) |
| `message` | string | Yes | Message text |
| `session` | string | No | WAHA session (default `WAHA_SESSION`) |

### send_whatsapp_series

Send to several recipients **one after another**. Returns a `jobId` right away, so the MCP client is never blocked while the series runs in the background.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recipients` | array | Yes | `[{ phone, name?, message? }]`, sent in order |
| `message` | string | No | Template for recipients without their own `message`; supports `{name}`, `{phone}` |
| `session` | string | No | WAHA session |

### whatsapp_series_status / cancel_whatsapp_series

Take a `job_id`. Status lists every recipient (`queued`, `sent`, `failed`, `skipped`, `cancelled`) with message ids and errors. Cancel stops whatever is still queued.

### How the WhatsApp sender avoids account locking

- **Strictly serial per session**: all sends for a WAHA session share one queue, built as a promise chain. There are no mutexes, nothing blocks the event loop, and parallel tool calls can't burst messages.
- **Human-like flow** for every message: check the number exists → send seen → start typing for a time based on message length → stop typing → send.
- **Randomized gap** between messages (`WAHA_MIN_DELAY_MS`–`WAHA_MAX_DELAY_MS`, 20–60s by default) and a rolling **hourly cap** (`WAHA_HOURLY_LIMIT`, 40).
- **Skips** numbers that aren't on WhatsApp, duplicates and invalid numbers, so those never count as sends.
- **Session check**: a job only starts when the WAHA session is `WORKING`.
- **Circuit breaker**: the series stops after `WAHA_MAX_CONSECUTIVE_FAILURES` (3) failures in a row. Retries back off, with a long backoff on HTTP 429.
- Series are capped at `WAHA_MAX_SERIES_SIZE` (50) recipients.

To keep the risk low: message people who expect to hear from you, personalize the text (`{name}`), don't send links in the first message, and warm up new numbers slowly. Job state lives in memory and is lost when the server restarts.

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `WAHA_URL` | `http://localhost:3000` | WAHA base URL |
| `WAHA_API_KEY` | — | Sent as `X-Api-Key` |
| `WAHA_SESSION` | `default` | Default WAHA session |
| `WAHA_MIN_DELAY_MS` / `WAHA_MAX_DELAY_MS` | `20000` / `60000` | Random gap between messages |
| `WAHA_HOURLY_LIMIT` | `40` | Max messages per rolling hour per session |
| `WAHA_MAX_SERIES_SIZE` | `50` | Max recipients per series |
| `WAHA_MAX_CONSECUTIVE_FAILURES` | `3` | Abort series after this many failures in a row |

## Provider

This server integrates with the [web2sms.ro REST API](https://www.web2sms.ro/documentatie-api-sms/):

- **Send**: `POST https://www.web2sms.ro/prepaid/message`
- **Balance**: `BALANCE https://www.web2sms.ro/prepaid/message`
- **Status**: SOAP via `https://www.web2sms.ro/api`

## Disclaimer

This project is **not affiliated** with [web2sms.ro](https://www.web2sms.ro). SMS costs are billed to your prepaid account. Always obtain explicit user permission before sending messages. Do not use for spam or bulk messaging. Comply with Romanian telecom regulations (ANCOM) and GDPR.

## License

MIT
