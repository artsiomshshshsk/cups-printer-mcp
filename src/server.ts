import http from 'node:http';
import { mkdtemp, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { submitPrint, validatePrintFile, lpstat, cancelJobs } from './printing.js';

const QUEUE = process.env.PRINTER_QUEUE || 'Brother_HL_L2442DW';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

async function withTempFile<T>(prefix: string, name: string, data: Buffer, fn: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_') || 'file';
  const path = join(dir, safe);
  await writeFile(path, data);
  try {
    return await fn(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'printer-mcp', version: '1.0.0' });

  server.registerTool('print_file', {
    description: 'Print a file to the Brother HL-L2442DW. Provide base64-encoded content and a filename with a supported extension (pdf, txt, md, png, jpg, jpeg, gif, webp, tif, tiff). Max 25 MB.',
    inputSchema: {
      content_base64: z.string().describe('Base64-encoded file content'),
      filename: z.string().describe('Original filename, used for type detection'),
      copies: z.number().int().min(1).optional(),
      duplex: z.boolean().optional().describe('Double-sided, book-style'),
      pages: z.string().optional().describe('Page range, e.g. 1-5'),
    },
  }, async (args) => {
    const buf = Buffer.from(args.content_base64, 'base64');
    validatePrintFile(args.filename, buf.length);
    const jobId = await withTempFile('printer-mcp-', args.filename, buf, (path) =>
      submitPrint(path, { queue: QUEUE, duplex: args.duplex, copies: args.copies, pages: args.pages }),
    );
    return text(`Print job submitted: ${jobId}`);
  });

  server.registerTool('print_text', {
    description: 'Print plain text to the Brother HL-L2442DW.',
    inputSchema: {
      text: z.string().describe('Text to print'),
      title: z.string().optional(),
      copies: z.number().int().min(1).optional(),
      duplex: z.boolean().optional(),
    },
  }, async (args) => {
    const body = args.title ? `${args.title}\n\n${args.text}\n` : `${args.text}\n`;
    const jobId = await withTempFile('printer-mcp-text-', 'text.txt', Buffer.from(body, 'utf8'), (path) =>
      submitPrint(path, { queue: QUEUE, duplex: args.duplex, copies: args.copies }),
    );
    return text(`Print job submitted: ${jobId}`);
  });

  server.registerTool('printer_status', {
    description: 'Show printer queue state and the default printer.',
    inputSchema: {},
  }, async () => text(await lpstat(['-p', '-d'])));

  server.registerTool('job_status', {
    description: 'List pending and recently completed print jobs.',
    inputSchema: { job_id: z.string().optional() },
  }, async (args) => {
    const pending = await lpstat(['-o', QUEUE]).catch(() => '');
    const completed = await lpstat(['-W', 'completed', '-o']).catch(() => '');
    let out = `Pending:\n${pending || '(none)'}\nCompleted:\n${completed || '(none)'}`;
    if (args.job_id) out = out.split('\n').filter((l) => l.includes(args.job_id!) || l.startsWith('Pending') || l.startsWith('Completed')).join('\n');
    return text(out);
  });

  server.registerTool('cancel_job', {
    description: 'Cancel a print job by id, or all jobs on the queue with all=true.',
    inputSchema: { job_id: z.string().optional(), all: z.boolean().optional() },
  }, async (args) => {
    if (!args.all && !args.job_id) throw new Error('Provide job_id or all=true');
    const target = args.all ? '-a' : args.job_id!;
    const out = await cancelJobs(target);
    return text(out || `Cancelled: ${target}`);
  });

  return server;
}

export async function mcpHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  let body: unknown;
  if (req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    body = raw ? JSON.parse(raw) : undefined;
  }
  await transport.handleRequest(req, res, body);
}
