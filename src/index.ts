import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { sendSmsTool, handleSendSms } from './tools/send-sms.js';
import { checkStatusTool, handleCheckStatus } from './tools/check-status.js';
import { checkBalanceTool, handleCheckBalance } from './tools/check-balance.js';
import { startStdioTransport } from './server.js';

const config = loadConfig();

const server = new Server(
  {
    name: 'sms-web2sms-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [sendSmsTool, checkStatusTool, checkBalanceTool],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'send_sms':
      return handleSendSms(args, config);
    case 'check_status':
      return handleCheckStatus(args, config);
    case 'check_balance':
      return handleCheckBalance(args, config);
    default:
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  await startStdioTransport(server);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
