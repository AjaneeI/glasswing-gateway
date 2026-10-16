import { z } from 'zod';
import { GatewayError } from './errors';
import { createHash } from 'node:crypto';

const environmentSchema = z.strictObject({
  id: z.string().min(1).max(80),
  origin: z.string().url(),
  entryPath: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional(),
  allowedPathPrefixes: z.array(z.string().startsWith('/')).min(1),
  searchPath: z.string().startsWith('/'),
  searchQueryParam: z.string().regex(/^[a-zA-Z0-9_]+$/),
  readOnlyQueryRules: z
    .array(
      z.strictObject({
        pathPrefix: z.string().startsWith('/'),
        names: z.array(z.string().regex(/^[a-zA-Z0-9_\[\].-]+$/)).min(1),
      }),
    )
    .optional(),
  /**
   * Opt-in checkout testing. Omitted or disabled leaves the environment
   * strictly read-only: cart and checkout paths stay blocked and every
   * non-GET request is still refused at the network layer.
   *
   * Enable this only for a storefront where a test order is harmless — a
   * Shopify development store with Bogus Gateway, or a staging clone. On a
   * live store the agent will create real carts and real abandoned-checkout
   * records.
   */
  checkout: z
    .strictObject({
      enabled: z.boolean(),
      /** Navigable checkout paths; mutations require the separate exact adapter. */
      pathPrefixes: z.array(z.string().startsWith('/')).min(1),
      /** Explicit Shopify-compatible add adapter. No arbitrary mutation endpoint. */
      cartAddPath: z.enum(['/cart/add', '/cart/add.js']).optional(),
    })
    .optional(),
  allowLoopback: z.boolean().default(false),
});
export type TestEnvironment = z.infer<typeof environmentSchema>;
export const environmentPolicy = (env: TestEnvironment) =>
  createHash('sha256').update(JSON.stringify(env)).digest('hex');
export function environments(): TestEnvironment[] {
  try {
    const result = z
      .array(environmentSchema)
      .parse(JSON.parse(process.env.GATEWAY_TEST_ENVIRONMENTS || '[]'));
    if (new Set(result.map((item) => item.id)).size !== result.length) throw new Error();
    for (const env of result) {
      const url = new URL(env.origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== env.origin ||
        url.username ||
        url.password
      )
        throw new Error();
    }
    return result;
  } catch {
    throw new GatewayError(
      'CONFIGURATION_ERROR',
      'GATEWAY_TEST_ENVIRONMENTS must contain valid test environment configurations.',
      503,
    );
  }
}
export function environment(id: string) {
  const env = environments().find((entry) => entry.id === id);
  if (!env)
    throw new GatewayError('UNKNOWN_ENVIRONMENT', 'Select a server-configured test environment.');
  return env;
}
export const limits = { pages: 5, steps: 10, sessionMs: 180_000, modelMs: 40_000, scanMs: 900_000 };
