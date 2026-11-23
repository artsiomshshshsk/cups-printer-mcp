#!/usr/bin/env node
import 'dotenv/config';
import { startHttp } from './auth.js';
import { mcpHandler } from './server.js';

const token = process.env.PRINTER_MCP_TOKEN;
if (!token || token === 'change-me') {
  console.error('PRINTER_MCP_TOKEN is not set (see .env.example)');
  process.exit(1);
}
const port = Number(process.env.PORT || 18978);
startHttp({ token, port, mcpHandler });
console.log(`printer-mcp listening on 0.0.0.0:${port}`);
