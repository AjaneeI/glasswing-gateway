import { z } from 'zod';
import { categoryReportSchema, readinessForScan, readinessOverview } from './readiness';
import { environments } from './config';
import { GatewayError, isGatewayError, publicError } from './errors';
import {
  inspectRequestSchema,
  reviewSchema,
  scanRequestSchema,
  type ModelCall,
  type Scan,
} from './schemas';
import type { GatewayService } from './service';

export function usage(calls: ModelCall[]) {
  return {
    inputTokens: calls.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: calls.reduce((sum, item) => sum + item.outputTokens, 0),
    estimatedCostUsd: calls.every((item) => item.estimatedCostUsd !== null)
      ? calls.reduce((sum, item) => sum + item.estimatedCostUsd!, 0)
      : null,
  };
}
function scanSummary(scan: Scan) {
  return {
    id: scan.id,
    status: scan.status,
    fixture: scan.fixture,
    merchantUrl: scan.draft.merchantUrl,
    environmentId: scan.draft.environmentId,
    createdAt: scan.createdAt,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    sessionCount: scan.sessions.length,
    passed: scan.sessions.filter((session) => session.evaluation?.outcome === 'passed').length,
    failed: scan.sessions.filter(
      (session) => session.evaluation?.outcome === 'failed' || session.status === 'failed',
    ).length,
    inconclusive: scan.sessions.filter((session) => session.evaluation?.outcome === 'inconclusive')
      .length,
    findingCount: scan.findings.length,
    usage: usage(scan.modelCalls),
  };
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new GatewayError('INVALID_CONTENT_TYPE', 'Send application/json.', 415);
  if (Number(request.headers.get('content-length') || 0) > 128_000)
    throw new GatewayError('PAYLOAD_TOO_LARGE', 'Request body exceeds 128 KB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GatewayError('INVALID_JSON', 'A JSON request body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 128_000) {
        await reader.cancel();
        throw new GatewayError('PAYLOAD_TOO_LARGE', 'Request body exceeds 128 KB.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GatewayError('INVALID_JSON', 'The request body is not valid JSON.');
  }
  return schema.parse(parsed);
}
function paginate<T>(items: T[], url: URL) {
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 25);
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new GatewayError('INVALID_PAGINATION', 'Use offset >= 0 and limit between 1 and 100.');
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
}
export async function handleGateway(
  request: Request,
  segments: string[],
  authenticate: () => Promise<string>,
  service: GatewayService,
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const ownerId = await authenticate();
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      // Next.js may use an internal hostname behind a proxy. Trust only the
      // configured public origin in addition to the request URL, never a
      // caller-supplied forwarded-host header.
      const permittedOrigins = new Set([url.origin]);
      if (process.env.NEXT_PUBLIC_SITE_URL)
        permittedOrigins.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
      if (origin && !permittedOrigins.has(origin))
        throw new GatewayError('ORIGIN_MISMATCH', 'Cross-origin mutations are not permitted.', 403);
    }
    const [resource, id, action] = segments;
    let data: unknown;
    let status = 200;
    if (segments.length > 3) throw new GatewayError('NOT_FOUND', 'Endpoint not found.', 404);
    if (resource === 'sessions' && id && action === 'screenshot' && request.method === 'GET') {
      const session = await service.session(ownerId, id);
      const observationId = url.searchParams.get('observation');
      const observation = session.trace.find(
        (event) => event.observation?.id === observationId,
      )?.observation;
      if (!observation?.screenshotAvailable)
        throw new GatewayError('NOT_FOUND', 'Screenshot not available.', 404);
      const image = await service.store.screenshot(ownerId, observation.id);
      return new Response(new Uint8Array(image), {
        headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' },
      });
    } else if (resource === 'environments' && !id && request.method === 'GET')
      data = {
        items: environments().map(({ id, origin, searchPath, entryPath }) => ({
          id,
          origin,
          entryUrl: new URL(entryPath || '/', origin).href,
          searchPath,
          authorizedStoppingPoint: 'recommend_or_decline',
        })),
      };
    else if (resource === 'model-calls' && !id && request.method === 'GET')
      data = paginate(
        (await service.store.listCalls(ownerId)).sort((a, b) =>
          b.recordedAt.localeCompare(a.recordedAt),
        ),
        url,
      );
    else if (resource === 'drafts' && !id && request.method === 'GET')
      data = paginate(
        (await service.store.listDrafts(ownerId)).map(
          ({ id, merchantUrl, createdAt, revision, approvedAt, fixture }) => ({
            id,
            merchantUrl,
            createdAt,
            revision,
            approvedAt,
            fixture,
          }),
        ),
        url,
      );
    else if (resource === 'drafts' && !id && request.method === 'POST') {
      data = await service.inspect(ownerId, await readJson(request, inspectRequestSchema));
      status = 201;
    } else if (resource === 'drafts' && id && !action && request.method === 'GET')
      data = await service.store.get('draft', ownerId, id);
    else if (resource === 'drafts' && id && !action && request.method === 'PATCH')
      data = await service.review(ownerId, id, await readJson(request, reviewSchema));
    else if (resource === 'scans' && id && action === 'readiness' && request.method === 'GET')
      data = readinessForScan(await service.store.get('scan', ownerId, id));
    else if (resource === 'scans' && id && action === 'readiness' && request.method === 'POST') {
      const report = await readJson(request, categoryReportSchema);
      data = await service.store.exclusive(`readiness:${id}`, async () => {
        const scan = await service.store.get('scan', ownerId, id);
        if (['queued', 'running'].includes(scan.status))
          throw new GatewayError(
            'SCAN_ACTIVE',
            'Submit category reports after the scan stops.',
            409,
          );
        const ids = new Set([
          ...scan.draft.evidence.map((o) => o.id),
          ...scan.sessions.flatMap((s) =>
            s.trace.flatMap((e) => [e.id, ...(e.observation ? [e.observation.id] : [])]),
          ),
        ]);
        if (report.checks.some((c) => c.evidenceIds.some((evidenceId) => !ids.has(evidenceId))))
          throw new GatewayError(
            'INVALID_PROVENANCE',
            'Category checks must cite evidence from this scan.',
            422,
          );
        scan.categoryReports = [
          ...(scan.categoryReports || []).filter((r) => r.category !== report.category),
          { ...report, recordedAt: new Date().toISOString() },
        ];
        await service.store.save('scan', scan);
        return readinessForScan(scan);
      });
    } else if (resource === 'scans' && !id && request.method === 'POST') {
      data = await service.createScan(ownerId, await readJson(request, scanRequestSchema));
      status = 201;
    } else if (resource === 'scans' && id && action === 'run' && request.method === 'POST')
      data = await service.runScan(ownerId, id);
    else if (resource === 'scans' && id && !action && request.method === 'GET')
      data = await service.store.get('scan', ownerId, id);
    else if (resource === 'scans' && !id && request.method === 'GET')
      data = paginate((await service.store.listScans(ownerId)).map(scanSummary), url);
    else if (
      resource === 'sessions' &&
      id &&
      (!action || action === 'replay') &&
      request.method === 'GET'
    ) {
      const session = await service.session(ownerId, id);
      data =
        action === 'replay'
          ? {
              sessionId: id,
              scanId: session.scanId,
              fixture: session.fixture,
              events: session.trace,
              evaluation: session.evaluation,
              modelCalls: session.modelCalls,
            }
          : session;
    } else if (
      ['sessions', 'findings', 'dashboard'].includes(resource) &&
      !id &&
      request.method === 'GET'
    ) {
      let scans = await service.store.listScans(ownerId);
      const scanId = url.searchParams.get('scanId');
      if (scanId) scans = [await service.store.get('scan', ownerId, scanId)];
      const sessions = scans.flatMap((scan) => scan.sessions);
      if (resource === 'sessions') {
        const filtered = sessions.filter(
          (session) =>
            (!url.searchParams.has('status') ||
              session.status === url.searchParams.get('status')) &&
            (!url.searchParams.has('mode') ||
              session.scenario.mode === url.searchParams.get('mode')) &&
            (!url.searchParams.has('outcome') ||
              session.evaluation?.outcome === url.searchParams.get('outcome')),
        );
        data = paginate(
          filtered.map(({ trace, modelCalls, ...session }) => ({
            ...session,
            steps: trace.length,
            usage: usage(modelCalls),
          })),
          url,
        );
      } else if (resource === 'findings')
        data = paginate(
          scans.flatMap((scan) =>
            scan.findings.map((finding) => ({
              ...finding,
              scanId: scan.id,
              fixture: scan.fixture,
            })),
          ),
          url,
        );
      else {
        const realSessions = scans.filter((scan) => !scan.fixture).flatMap((scan) => scan.sessions);
        const evaluated = realSessions.filter((session) => session.evaluation !== null);
        data = {
          readiness: readinessOverview(scans),
          scans: scans.slice(0, 10).map(scanSummary),
          totalScans: scans.length,
          totalSessions: sessions.length,
          fixtureSessions: sessions.filter((session) => session.fixture).length,
          evaluatedSessions: evaluated.length,
          passedSessions: evaluated.filter((session) => session.evaluation?.outcome === 'passed')
            .length,
          passRate: evaluated.length
            ? evaluated.filter((session) => session.evaluation?.outcome === 'passed').length /
              evaluated.length
            : null,
          findings: scans.reduce((sum, scan) => sum + scan.findings.length, 0),
          usage: usage(await service.store.listCalls(ownerId)),
        };
      }
    } else throw new GatewayError('NOT_FOUND', 'Endpoint or method not found.', 404);
    return Response.json({ apiVersion: 'v1', data }, { status, headers });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          apiVersion: 'v1',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request does not match the API schema.',
            retryable: false,
            issues: error.issues.map(({ path, message }) => ({ path, message })),
          },
        },
        { status: 400, headers },
      );
    if (!isGatewayError(error)) console.error('[gateway] unhandled error', error);
    return Response.json(
      { apiVersion: 'v1', error: publicError(error) },
      { status: isGatewayError(error) ? error.status : 500, headers },
    );
  }
}
