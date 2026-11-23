import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startHttp } from '../auth.js';
import { mcpHandler } from '../server.js';

describe('mcp server over http', () => {
  let server: http.Server;
  let port: number;
  beforeAll(async () => {
    server = startHttp({ token: 'tok', port: 0, mcpHandler });
    await new Promise<void>((r) => server.once('listening', () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const connect = (auth?: string) => {
    const headers: Record<string, string> = {};
    if (auth) headers.Authorization = auth;
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers } });
    const client = new Client({ name: 'test', version: '1.0.0' });
    return { client, transport };
  };

  test('lists the five print tools', async () => {
    const { client, transport } = connect('Bearer tok');
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(['cancel_job', 'job_status', 'print_file', 'print_text', 'printer_status']);
    await client.close();
  });

  test('rejects missing token', async () => {
    const { client, transport } = connect();
    await expect(client.connect(transport)).rejects.toBeTruthy();
  });

  test('printer_status returns queue info', async () => {
    const { client, transport } = connect('Bearer tok');
    await client.connect(transport);
    const res = await client.callTool({ name: 'printer_status', arguments: {} });
    expect(JSON.stringify(res.content)).toContain('Brother_HL_L2442DW');
    await client.close();
  });
});
