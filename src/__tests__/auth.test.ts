import http from 'node:http';
import { checkBearer, startHttp } from '../auth.js';

describe('checkBearer', () => {
  const tok = 'secret-token';
  test('valid', () => expect(checkBearer('Bearer secret-token', tok)).toBe(true));
  test('missing', () => expect(checkBearer(undefined, tok)).toBe(false));
  test('wrong', () => expect(checkBearer('Bearer nope', tok)).toBe(false));
  test('wrong scheme', () => expect(checkBearer('Basic secret-token', tok)).toBe(false));
  test('no value', () => expect(checkBearer('Bearer', tok)).toBe(false));
  test('empty', () => expect(checkBearer('', tok)).toBe(false));
});

describe('startHttp', () => {
  let server: http.Server;
  let port: number;
  beforeAll(async () => {
    server = startHttp({ token: 'tok', port: 0, mcpHandler: (_req, res) => { res.writeHead(200); res.end('mcp-ok'); } });
    await new Promise<void>((r) => server.once('listening', () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  const req = (path: string, method: string, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, { method, headers });
  test('health no auth', async () => expect((await req('/health', 'GET')).status).toBe(200));
  test('mcp no token 401', async () => expect((await req('/mcp', 'POST')).status).toBe(401));
  test('mcp bad token 401', async () => expect((await req('/mcp', 'POST', { Authorization: 'Bearer bad' })).status).toBe(401));
  test('mcp valid passes', async () => {
    const r = await req('/mcp', 'POST', { Authorization: 'Bearer tok' });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('mcp-ok');
  });
});
