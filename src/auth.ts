import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export function checkBearer(header: string | undefined, token: string): boolean {
  if (!header) return false;
  const m = header.match(/^Bearer (.+)$/);
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface HttpOpts {
  token: string;
  port: number;
  mcpHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;
}

export function startHttp(opts: HttpOpts): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (!checkBearer(req.headers.authorization, opts.token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    Promise.resolve(opts.mcpHandler(req, res)).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    });
  });
  server.listen(opts.port);
  return server;
}
