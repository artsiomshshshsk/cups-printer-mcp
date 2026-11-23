# printer-mcp

A token-authenticated [Model Context Protocol](https://modelcontextprotocol.io)
server that lets any AI harness print to a CUPS printer on macOS. Self-hosted and
reachable from inside or outside your network over streamable HTTP with a Bearer
token. Built and tested with a Brother HL-L2442DW; works with any CUPS queue.

- **MCP endpoint:** `http://YOUR_HOST:18978/mcp` (streamable HTTP)
- **Health:** `http://YOUR_HOST:18978/health` (no auth)
- **Auth:** `Authorization: Bearer <token>` on every MCP request.

> The server speaks plain HTTP. Anyone on the network path can read the token and
> the documents you print. Use a strong token, and put it behind TLS (a reverse
> proxy) or a VPN if that matters to you.

## Tools

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `print_file` | `content_base64`, `filename`, `copies?`, `duplex?`, `pages?` | Print a file (pdf/txt/md/png/jpg/jpeg/gif/webp/tif/tiff, max 25 MB) |
| `print_text` | `text`, `title?`, `copies?`, `duplex?` | Print plain text |
| `printer_status` | — | Queue state and default printer |
| `job_status` | `job_id?` | Pending and completed jobs |
| `cancel_job` | `job_id?`, `all?` | Cancel one job or all |

## Run the server

Requirements: macOS with CUPS, a configured printer queue, Node.js 20+.

```bash
npm install
cp .env.example .env
# edit .env:
#   PRINTER_MCP_TOKEN  -> a strong secret, e.g. `openssl rand -hex 32`
#   PRINTER_QUEUE      -> your queue name (see `lpstat -p`)
#   PORT               -> default 18978
npm run build
npm start
```

Check it:

```bash
curl http://localhost:18978/health
curl -X POST http://localhost:18978/mcp \
  -H "Authorization: Bearer $PRINTER_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

## Run as a boot service (launchd)

`deploy/` has a path-agnostic LaunchDaemon template and installer. It starts the
server at boot (no GUI login needed), runs it as the repo owner, and restarts it
on crash:

```bash
sudo bash deploy/install-daemon.sh
tail -f ~/Library/Logs/printer-mcp.log
sudo launchctl kickstart -k system/com.printer-mcp   # restart
```

## Reach it from outside your network

Forward a TCP port on your router to this host's `PORT`, then use your public IP
or hostname as `YOUR_HOST`. Keep the token secret. For anything sensitive, prefer
a TLS reverse proxy or a VPN over exposing plain HTTP.

## Install in a harness

Replace `YOUR_HOST` and `YOUR_TOKEN`.

**Claude Code**
```bash
claude mcp add --transport http printer http://YOUR_HOST:18978/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

**Codex** (`~/.codex/config.toml`)
```toml
[mcp_servers.printer]
url = "http://YOUR_HOST:18978/mcp"
bearer_token_env_var = "PRINTER_MCP_TOKEN"
```
Export `PRINTER_MCP_TOKEN=YOUR_TOKEN` where Codex runs.

**Cursor** (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "printer": {
      "url": "http://YOUR_HOST:18978/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**Kimi Code / other HTTP MCP clients:** add an HTTP MCP server with the URL above
and the `Authorization: Bearer YOUR_TOKEN` header.

## Development

```bash
npm test          # jest (unit + MCP integration)
npm run build     # tsc -> build/
```

Layout: `src/printing.ts` (CUPS helpers), `src/auth.ts` (Bearer + health),
`src/server.ts` (MCP tools + stateless streamable HTTP), `src/index.ts` (entry).

## License

MIT — see [LICENSE](LICENSE).
