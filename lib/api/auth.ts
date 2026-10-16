import { createClient } from '../supabase/server';
import { GatewayError, isGatewayError, publicError } from '../gateway/errors';
import { z } from 'zod';

export async function requireOwner(request?: Request): Promise<string> {
  if (request && !['GET', 'HEAD'].includes(request.method)) {
    const allowed = new Set([new URL(request.url).origin]);
    if (process.env.NEXT_PUBLIC_SITE_URL)
      allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
    const origin = request.headers.get('origin');
    if (origin && !allowed.has(origin))
      throw new GatewayError('ORIGIN_MISMATCH', 'Cross-origin mutations are not permitted.', 403);
  }
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) throw new Error();
    return user.id;
  } catch {
    throw new GatewayError('AUTHENTICATION_REQUIRED', 'Authentication required.', 401);
  }
}
export function apiError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof z.ZodError
          ? { code: 'VALIDATION_ERROR', message: 'Invalid request.' }
          : publicError(error),
    },
    {
      status: error instanceof z.ZodError ? 400 : isGatewayError(error) ? error.status : 500,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
