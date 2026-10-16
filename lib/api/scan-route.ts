import { requireOwner, apiError } from './auth';

/** Legacy panels are immutable fixtures. Actual reports use owner-scoped Gateway scans. */
export function createScanRoute<T extends { scanId?: string; scannedAt?: string }>(
  initial: T,
  _requiredNumberFields: (keyof T & string)[],
  _requiredArrayField: keyof T & string,
  authenticate: () => Promise<string> = requireOwner,
) {
  const fixture = JSON.stringify(initial);

  async function GET() {
    try {
      await authenticate();
      return new Response(fixture, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
          'X-Gateway-Evidence-Mode': 'fixture',
        },
      });
    } catch (error) {
      return apiError(error);
    }
  }

  async function POST() {
    try {
      await authenticate();
      return Response.json(
        {
          error:
            'Legacy reports are immutable fixtures. Submit evidence to /api/gateway/scans/:id/readiness.',
        },
        { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'private, no-store' } },
      );
    } catch (error) {
      return apiError(error);
    }
  }

  return { GET, POST };
}
