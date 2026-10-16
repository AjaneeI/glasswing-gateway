import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { GatewayError } from './errors';

const counter = z.object({
  jobs: z.number().int().nonnegative(),
  calls: z.number().int().nonnegative(),
  reservedUsd: z.number().nonnegative(),
});
const ledgerSchema = z.object({ total: counter, owners: z.record(z.string(), counter) });
type Ledger = z.infer<typeof ledgerSchema>;
type Execution = {
  owner: string;
  fixture: boolean;
  signal: AbortSignal;
  ledger: Ledger;
  path: string;
  calls: number;
  reservedUsd: number;
  queue: Promise<void>;
};
const context = new AsyncLocalStorage<Execution>();
const empty = () => ({ jobs: 0, calls: 0, reservedUsd: 0 });
const refuse = (message: string) => new GatewayError('EXECUTION_LIMIT', message, 429);
function ceiling(name: string, fallback?: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0)
    throw new GatewayError(
      'CONFIGURATION_ERROR',
      `${name} must be a positive server-configured limit.`,
      503,
    );
  return value;
}
async function save(execution: Execution) {
  const temporary = `${execution.path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(execution.ledger), { mode: 0o600 });
  await rename(temporary, execution.path);
}

/** One persistent deployment sharing a local filesystem. A crash leaves the lock
 * closed for operator inspection; never expire a lock while work may still run. */
export async function withExecutionBudget<T>(
  ownerId: string,
  fixture: boolean,
  run: () => Promise<T>,
  directory = process.env.GATEWAY_DATA_DIR || join(process.cwd(), '.gateway-data'),
): Promise<T> {
  if (!fixture) {
    const permitted = (process.env.GATEWAY_LIVE_OWNER_IDS || '').split(',').map((id) => id.trim());
    if (!permitted.includes(ownerId))
      throw new GatewayError(
        'LIVE_ACCESS_DENIED',
        'This account is not authorized for live model execution.',
        403,
      );
    ceiling('GATEWAY_DAILY_OWNER_USD');
    ceiling('GATEWAY_DAILY_GLOBAL_USD');
    ceiling('GATEWAY_OPERATION_USD');
  }
  const root = join(directory, 'execution-limits');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = join(root, 'active.lock');
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw refuse('An execution is active or requires crash recovery.');
    throw error;
  }
  try {
    const path = join(root, `${new Date().toISOString().slice(0, 10)}.json`);
    let ledger: Ledger;
    try {
      ledger = ledgerSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      ledger = { total: empty(), owners: {} };
    }
    const owner = createHash('sha256').update(ownerId).digest('hex');
    ledger.owners[owner] ||= empty();
    if (
      ledger.owners[owner].jobs >= ceiling('GATEWAY_DAILY_OWNER_JOBS', 20) ||
      ledger.total.jobs >= ceiling('GATEWAY_DAILY_GLOBAL_JOBS', 100)
    )
      throw refuse('Daily execution count reached.');
    ledger.owners[owner].jobs++;
    ledger.total.jobs++;
    const execution: Execution = {
      owner,
      fixture,
      signal: AbortSignal.timeout(900_000),
      ledger,
      path,
      calls: 0,
      reservedUsd: 0,
      queue: Promise.resolve(),
    };
    await save(execution);
    return await context.run(execution, run);
  } finally {
    await rmdir(lock);
  }
}

export function executionSignal(): AbortSignal {
  return context.getStore()?.signal || AbortSignal.timeout(40_000);
}

/** Reserve BEFORE every attempt, including retries; failures never refund an
 * uncertain charge. Rates are operator-supplied upper bounds, not a billing quote. */
export async function reserveModelCall(model: string, payload: string, outputTokens: number) {
  const current = context.getStore();
  if (!current || current.fixture)
    throw new GatewayError(
      'EXECUTION_REQUIRED',
      'Live model calls require an admitted execution.',
      403,
    );
  const reservation = current.queue.then(async () => {
    current.signal.throwIfAborted();
    const bytes = Buffer.byteLength(payload);
    if (bytes > 100_000)
      throw new GatewayError('MODEL_INPUT_LIMIT', 'Model request exceeds 100 KB.', 413);
    const pricing = z
      .record(
        z.string(),
        z.object({
          inputPerMillion: z.number().positive(),
          outputPerMillion: z.number().positive(),
        }),
      )
      .parse(JSON.parse(process.env.GATEWAY_MODEL_PRICING || '{}'));
    const rates = pricing[model];
    if (!rates)
      throw new GatewayError(
        'CONFIGURATION_ERROR',
        'Live execution requires model pricing upper bounds.',
        503,
      );
    // UTF-8 bytes plus schema/framing allowance conservatively bound input tokens.
    const usd =
      ((bytes + 4096) * rates.inputPerMillion + outputTokens * rates.outputPerMillion) / 1_000_000;
    const owner = current.ledger.owners[current.owner];
    const total = current.ledger.total;
    if (
      current.calls >= 120 ||
      total.calls >= ceiling('GATEWAY_DAILY_GLOBAL_CALLS', 500) ||
      owner.calls >= ceiling('GATEWAY_DAILY_OWNER_CALLS', 150) ||
      current.reservedUsd + usd > ceiling('GATEWAY_OPERATION_USD') ||
      owner.reservedUsd + usd > ceiling('GATEWAY_DAILY_OWNER_USD') ||
      total.reservedUsd + usd > ceiling('GATEWAY_DAILY_GLOBAL_USD')
    )
      throw refuse('Model call or reserved spending limit reached.');
    current.calls++;
    current.reservedUsd += usd;
    owner.calls++;
    owner.reservedUsd += usd;
    total.calls++;
    total.reservedUsd += usd;
    await save(current);
  });
  // A failed reservation ends admission for this operation. Do not recover this
  // queue: a filesystem failure may leave the persisted accounting uncertain,
  // and concurrent jobs must not continue spending after a refusal.
  current.queue = reservation;
  await reservation;
}
