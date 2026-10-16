import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GatewayError } from './errors';
import type { Draft, ModelCall, Scan } from './schemas';

export class FileStore {
  readonly runtimeId = randomUUID();
  private locks = new Set<string>();
  constructor(
    readonly directory = process.env.GATEWAY_DATA_DIR || join(process.cwd(), '.gateway-data'),
  ) {}
  private folder(ownerId: string) {
    return join(this.directory, createHash('sha256').update(ownerId).digest('hex'));
  }
  private path(ownerId: string, type: 'draft' | 'scan' | 'call', id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new GatewayError('NOT_FOUND', 'Resource not found.', 404);
    return join(this.folder(ownerId), `${type}-${id}.json`);
  }
  async save(type: 'draft', record: Draft): Promise<void>;
  async save(type: 'scan', record: Scan): Promise<void>;
  async save(type: 'draft' | 'scan', record: Draft | Scan) {
    const path = this.path(record.ownerId, type, record.id);
    await mkdir(this.folder(record.ownerId), { recursive: true, mode: 0o700 });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
    await rename(temp, path);
  }
  async get(type: 'draft', ownerId: string, id: string): Promise<Draft>;
  async get(type: 'scan', ownerId: string, id: string): Promise<Scan>;
  async get(type: 'draft' | 'scan', ownerId: string, id: string): Promise<Draft | Scan> {
    try {
      const record = JSON.parse(await readFile(this.path(ownerId, type, id), 'utf8')) as
        Draft | Scan;
      if (record.ownerId !== ownerId)
        throw new GatewayError('NOT_FOUND', 'Resource not found.', 404);
      if (type === 'scan') {
        const scan = record as Scan;
        if (scan.status === 'running' && scan.runtimeId !== this.runtimeId) {
          scan.status = 'interrupted';
          scan.completedAt = new Date().toISOString();
          for (const session of scan.sessions) {
            if (session.status === 'running' || session.status === 'queued') {
              session.status = 'interrupted';
              session.completedAt = scan.completedAt;
              session.error = {
                code: 'RUN_INTERRUPTED',
                message:
                  'The server restarted before this session completed. Create a new scan to rerun.',
                retryable: false,
              };
            }
          }
          await this.save('scan', scan);
        }
      }
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new GatewayError('NOT_FOUND', 'Resource not found.', 404);
      throw error;
    }
  }
  async listDrafts(ownerId: string) {
    let files: string[];
    try {
      files = await readdir(this.folder(ownerId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const drafts = await Promise.all(
      files
        .filter((file) => /^draft-[0-9a-f-]{36}\.json$/i.test(file))
        .map((file) => this.get('draft', ownerId, file.slice(6, -5))),
    );
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listScans(ownerId: string) {
    let files: string[];
    try {
      files = await readdir(this.folder(ownerId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const scans = await Promise.all(
      files
        .filter((file) => /^scan-[0-9a-f-]{36}\.json$/i.test(file))
        .map((file) => this.get('scan', ownerId, file.slice(5, -5))),
    );
    return scans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async recordCall(ownerId: string, operationId: string, call: ModelCall) {
    await mkdir(this.folder(ownerId), { recursive: true, mode: 0o700 });
    const path = this.path(ownerId, 'call', call.id);
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(
      temp,
      JSON.stringify({ ...call, operationId, recordedAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
    await rename(temp, path);
  }
  async saveScreenshot(ownerId: string, id: string, image: Buffer) {
    const path = this.path(ownerId, 'scan', id).replace(/\.json$/, '.jpg');
    await mkdir(this.folder(ownerId), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, image, { mode: 0o600 });
    await rename(temporary, path);
  }
  async screenshot(ownerId: string, id: string) {
    try {
      return await readFile(this.path(ownerId, 'scan', id).replace(/\.json$/, '.jpg'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new GatewayError('NOT_FOUND', 'Screenshot not available.', 404);
      throw error;
    }
  }
  async listCalls(
    ownerId: string,
  ): Promise<(ModelCall & { operationId: string; recordedAt: string })[]> {
    let files: string[];
    try {
      files = await readdir(this.folder(ownerId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return Promise.all(
      files
        .filter((file) => /^call-[0-9a-f-]{36}\.json$/i.test(file))
        .map(async (file) => JSON.parse(await readFile(join(this.folder(ownerId), file), 'utf8'))),
    );
  }
  async exclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.locks.has(key))
      throw new GatewayError('CONFLICT', 'This resource is already being modified or run.', 409);
    this.locks.add(key);
    try {
      return await operation();
    } finally {
      this.locks.delete(key);
    }
  }
}
