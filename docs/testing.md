# Test modes and prerequisites

Use Node.js 22 and install dependencies with `npm ci --ignore-scripts`, then install Chromium with `npx playwright install chromium`. Use a dedicated local checkout without production credentials.

| Invocation                         | What runs                                                                                  | What it does not establish                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `npm run test:backend`             | Domain, evaluation, storage, spend/network/action boundaries, local browser fixtures       | Hosted identity, real merchant outcomes, live model quality |
| `npm run test:bridge`              | Full local application with synthetic Supabase endpoints, fixture models, local storefront | Real Supabase signup/email or provider acceptance           |
| `npm run test:e2e`                 | Complete configured suite, including gated cases                                           | Skipped cases are not passes                                |
| `npm run typecheck`                | TypeScript consistency                                                                     | Runtime safety                                              |
| `npm run build`                    | Production compilation and route generation                                                | Deployment acceptance                                       |
| `npm audit --audit-level=moderate` | Current registry advisories for the lockfile                                               | Absence of undisclosed vulnerabilities                      |

For the full suite, start `npm run dev -- --hostname 127.0.0.1` in a second terminal and run `GATEWAY_TEST_URL=http://localhost:3000 npm run test:e2e`. Use the same canonical local hostname for app and test URLs. Backend/bridge tests create their own local servers; the standalone login/Discover/integration checks use the app URL.

## Gated tests

- Six workspace cases require `GATEWAY_TEST_STORAGE_STATE` pointing to an authenticated storage-state file outside the repository.
- One live account case requires `GATEWAY_TEST_EMAIL` and `GATEWAY_TEST_PASSWORD` for a confirmed test account with the profile migration applied.
- Three external storefront cases require `GATEWAY_LIVE_STOREFRONTS=1` and network access. They perform read-only browser observations; configure only authorized test targets.
- Three real-model cases require `GATEWAY_LIVE_AI=1`, OpenAI credentials, owner admission, model prices, and positive spend limits. These may incur charges and are not part of a no-paid-service verification run.
- One screenshot capture requires `GATEWAY_CAPTURE_SCREENSHOTS=1`. It creates local images and capture metadata; review their contents and rights before any distribution. No screenshot is included in this edition.

Use the exact environment names and prerequisites in the test source and [API guide](gateway-api.md) when enabling optional cases. Keep credentials and storage state out of source. Test outputs, temporary captures, and `.next*` directories are generated data, not release content.
