import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const nextConfig = (phase: string): NextConfig => ({
  // Keep production builds from replacing bundles used by a running dev server.
  distDir:
    process.env.GATEWAY_NEXT_DIST_DIR ||
    (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['playwright', 'playwright-core'],
});
export default nextConfig;
