# sms-web2sms-mcp-server

MCP (Model Context Protocol) server for sending SMS via [web2sms.ro](https://www.web2sms.ro) Romanian SMS gateway.

## Features

- **send_sms** — Send SMS messages to Romanian phone numbers
- **check_status** — Check delivery status of sent messages
- **check_balance** — Check prepaid credit balance
- Per-request credential overrides (or use environment defaults)
- SHA-512 HMAC authentication
- Full error code mapping with retry hints

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

## Provider

This server integrates with the [web2sms.ro REST API](https://www.web2sms.ro/documentatie-api-sms/):

- **Send**: `POST https://www.web2sms.ro/prepaid/message`
- **Balance**: `BALANCE https://www.web2sms.ro/prepaid/message`
- **Status**: SOAP via `https://www.web2sms.ro/api`

## Disclaimer

This project is **not affiliated** with [web2sms.ro](https://www.web2sms.ro). SMS costs are billed to your prepaid account. Always obtain explicit user permission before sending messages. Do not use for spam or bulk messaging. Comply with Romanian telecom regulations (ANCOM) and GDPR.

## License

MIT
