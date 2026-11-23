import { spawn } from 'node:child_process';

const ALLOWED = new Set(['pdf', 'txt', 'md', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tif', 'tiff']);
const MAX_BYTES = 25 * 1024 * 1024;

export interface LpOptions {
  queue: string;
  duplex?: boolean;
  copies?: number;
  pages?: string;
}

export function buildLpArgs(opts: LpOptions): string[] {
  const args = ['-d', opts.queue];
  if (opts.duplex) args.push('-o', 'sides=two-sided-long-edge');
  if (opts.copies && opts.copies > 1) args.push('-n', String(opts.copies));
  if (opts.pages) args.push('-P', opts.pages);
  return args;
}

export function validatePrintFile(filename: string, sizeBytes: number): void {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  if (!ALLOWED.has(ext)) throw new Error(`Unsupported file type: ${filename}`);
  if (sizeBytes <= 0) throw new Error('Empty file');
  if (sizeBytes > MAX_BYTES) throw new Error(`File too large (max 25 MB): ${sizeBytes} bytes`);
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.trim()}`)),
    );
  });
}

export async function submitPrint(filePath: string, opts: LpOptions): Promise<string> {
  const out = await run('lp', [...buildLpArgs(opts), filePath]);
  const m = out.match(/request id is (\S+)/);
  if (!m) throw new Error(`Could not parse job id from lp output: ${out.trim()}`);
  return m[1];
}

export function lpstat(args: string[]): Promise<string> {
  return run('lpstat', args);
}

export function cancelJobs(target: string): Promise<string> {
  return run('cancel', [target]);
}
