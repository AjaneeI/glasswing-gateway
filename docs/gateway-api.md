# Gateway AI service (v1)

The backend is part of the existing Next.js application. It uses the existing Supabase session cookie, owner-scoped JSON files, and a shared Playwright shopper runner. The Discover, dashboard, scan, sessions, replay and findings pages call these APIs. Discover provides merchant review and explicit approval; the shared app provider polls persisted progress across navigation and reloads.

## Setup

1. Configure Supabase as described in `supabase/README.md` and sign in.
2. Run `npm install` and `npx playwright install chromium`.
3. Copy `.env.example` to `.env.local`. For live execution, set `OPENAI_API_KEY`, explicitly allow authenticated owner UUIDs in `GATEWAY_LIVE_OWNER_IDS`, supply model-pricing upper bounds and positive operation/owner/global USD limits. Alternatively choose `GATEWAY_MODEL_MODE=fixture`; missing credentials never implicitly select fixtures. Replace `GATEWAY_TEST_ENVIRONMENTS` with an explicitly authorized staging/test storefront. Each environment has an exact `origin`, read-only `allowedPathPrefixes`, a `searchPath`, and `searchQueryParam`. Optional `entryPath` prepopulates the environment picker. Clients cannot expand the server policy. Missing Supabase configuration fails closed for protected APIs and account actions.
4. Run `npm run dev`. Use a **single persistent Node process** and a persistent, writable `GATEWAY_DATA_DIR` in deployments. The default is `.gateway-data/`, which is gitignored. Protect this directory as merchant data; it contains page text, observations and traces. There is no automatic retention/deletion policy in this prototype.

`GATEWAY_SYNTHESIS_MODEL` defaults to `gpt-6-luna`; shopper and independent evaluator default to `gpt-6-sol`. Overrides use `GATEWAY_SHOPPER_MODEL` and `GATEWAY_EVALUATOR_MODEL`. Models must be available to the configured account and support strict structured outputs. The provider uses the [OpenAI Responses structured-output API](https://developers.openai.com/api/docs/guides/structured-outputs), then validates results with Zod and checks evidence references on the server. There is no automatic fallback to another model.

Set `GATEWAY_MODEL_PRICING` to a JSON map keyed by model ID, with `inputPerMillion` and `outputPerMillion` in USD. Rates are operator supplied, not asserted current prices. Each call records requested model ID, prompt version, attempts, token usage across parsed responses (including invalid output), estimated cost and status. Unknown/unconfigured cost is `null`, never a fabricated zero. Estimates use uncached input rates and may overestimate cached-input charges; provider timeouts cannot reveal tokens billed by the upstream service. The owner-scoped call ledger retains failed synthesis attempts even when no draft was produced. Scan usage includes its draft-generation calls; dashboard usage counts actual calls once across scans.

## API contract

Base: `/api/gateway`. Every response is JSON and uses `Cache-Control: private, no-store`.

```ts
// Success
{ apiVersion: 'v1', data: T }
// Error
{ apiVersion: 'v1', error: { code: string, message: string, retryable: boolean, issues?: unknown[] } }
```

Domain contracts and request schemas are in `lib/gateway/schemas.ts`. Import their **types only** in client code. Never import the provider/service/store into client components. API keys are read only on the server and never serialized.

| Method | Path                   | Result                                                                              |
| ------ | ---------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/environments`        | Configured environment IDs and storefront origins                                   |
| GET    | `/drafts`              | Paginated saved draft summaries for resuming review                                 |
| POST   | `/drafts`              | Inspect storefront and generate an unapproved draft                                 |
| GET    | `/drafts/:id`          | Context, evidence, hypotheses, scenarios, revision and approval                     |
| PATCH  | `/drafts/:id`          | Replace archetypes/scenarios and approve or unapprove a revision                    |
| POST   | `/scans`               | Create a queued scan with an immutable copy of the approved draft                   |
| POST   | `/scans/:id/run`       | Execute the queued scan once; returns the final scan                                |
| GET    | `/scans/:id`           | Current full scan, including partial traces while running                           |
| GET    | `/scans`               | Paginated scan summaries                                                            |
| GET    | `/sessions`            | Paginated session summaries; optional `scanId`, `status`, `mode`, `outcome` filters |
| GET    | `/sessions/:id`        | Scenario, archetype, trace, evaluation, error and model calls                       |
| GET    | `/sessions/:id/replay` | Ordered events, observations, evaluation and model metadata                         |
| GET    | `/findings`            | Paginated findings with session, scan and evidence references; optional `scanId`    |
| GET    | `/dashboard`           | Counts, latest scans, real evaluated-session pass rate, fixture count and usage     |
| GET    | `/model-calls`         | Paginated model-call ledger, including failed inspection calls                      |

Lists return `{items, total, offset, limit}`. `offset` defaults to 0, `limit` to 25 (maximum 100). All resource lookups are scoped to the authenticated Supabase user; another user's resource returns 404. Mutations reject cross-origin browser requests. Set `NEXT_PUBLIC_SITE_URL` to the public app origin when Next.js runs behind an internal hostname or reverse proxy. JSON request bodies are limited to 128 KB.

### Complete browser-side workflow

Run from an authenticated page on this app:

```js
async function gateway(path, method = 'GET', body) {
  const response = await fetch(`/api/gateway${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw result.error;
  return result.data;
}

const draft = await gateway('/drafts', 'POST', {
  merchantUrl: 'https://staging.example.com/',
  environmentId: 'staging',
});
// Show draft.context, draft.evidence, draft.archetypes and draft.scenarios for
// merchant review. Let the merchant edit the latter two before this action.
const approved = await gateway(`/drafts/${draft.id}`, 'PATCH', {
  revision: draft.revision,
  archetypes: draft.archetypes,
  scenarios: draft.scenarios,
  approved: true,
});
const scan = await gateway('/scans', 'POST', {
  draftId: approved.id,
  revision: approved.revision,
});
const runningRequest = gateway(`/scans/${scan.id}/run`, 'POST');
// Poll GET /scans/:id on a separate request while this promise is pending.
const completed = await runningRequest;
const replay = await gateway(`/sessions/${completed.sessions[0].id}/replay`);
```

Review updates require the current revision, increment it, and set/clear approval. Edited hypotheses/scenarios get `merchant_edit` provenance while retaining source evidence references. All plans must cover legitimate, constraint and red_team modes and include an expected decline. Archetypes are behavioral hypotheses; they contain no demographic or traffic-share fields. Test mode is a scenario field, independent of archetype.

`run` is **synchronous and request-bound**, not a background job. Keep the request open and allow at least 15 minutes in the reverse proxy. Poll before retrying a lost request; scans execute once and repeated execution returns 409. New scans remain possible but share the same quotas. There is one admitted inspection, scan, or legacy swarm globally per persistent data directory, enforced by an atomic filesystem lock. Sessions use independent browser contexts. Defaults allow 20 operations per owner and 100 globally per UTC admission day; every live provider attempt, including retries, reserves maximum configured token cost before sending. There are also operation, owner and global call/spend caps. Reservations are deliberately not refunded after uncertain failures. Limits and pricing are operator-supplied, not an upstream billing guarantee.

The lock is fail-closed after a process crash. Before removing only `execution-limits/active.lock`, an operator must verify no execution or process using that data directory remains alive and inspect the retained records. Do not erase the daily ledger to resume work. See `.env.example` for limits. This prototype requires one persistent Node process and a shared local filesystem, not independent replicas or ephemeral serverless instances. Restarted running scans become `interrupted` on their next read. Historical drafts or a changed environment-policy fingerprint require a fresh inspection and approval before execution.

Creating a persisted queued scan also consumes an operation and requires live entitlement when applicable, so duplicate creation cannot bypass artifact-generation quotas. A typical inspect → create → run workflow consumes three operations. Inspection and creation are not idempotent: after an uncertain response, read the saved drafts/scans before retrying. Repeated invalid attempts may consume an operation; quotas fail closed.

## Execution and evaluation

Default actions are `navigate`, `search`, `inspect_product`, and `stop`. All require schema validation; unused action fields are null. Navigation requires an observed URL. Search uses the configured GET endpoint. Stopping either recommends one inspected product or declines. Shopper prompts do not receive the expected outcome.

Opt-in `checkout.enabled` adds `add_to_cart`, `view_cart`, `begin_checkout`, and `fill_checkout` only when the reviewed scenario also permits them. Use an authorized disposable test store. A cart add requires a previously inspected single-product page, an observed numeric variant, and an exact configured `cartAddPath` (`/cart/add` or `/cart/add.js`). Only one POST with the exact URL, form body and quantity 1 is permitted during that action. A successful endpoint must return without redirecting; adapters requiring redirects or different bodies are unsupported. All other non-GET requests, including page-script and input-event writes, are blocked. Cart mutation GETs and named order/payment/finalization paths are blocked. Checkout navigation follows an observed permitted link without clicking submit controls; filling changes only non-payment/non-billing fields using the synthetic test identity. This is not payment testing or proof that a purchase can complete. Path names alone cannot establish arbitrary merchant endpoint semantics; the operator must verify permitted GETs and the cart adapter are safe.

Each browser context starts fresh without imported cookies or credentials. Destinations are exact-origin restricted; DNS is checked once per context and requests are forwarded to the validated IP with the original TLS hostname. HTTP redirects are rejected; configure canonical URLs. Each resource is limited to 4 MB. Private, link-local, reserved and metadata destinations are rejected. `allowLoopback: true` permits loopback only for an explicitly configured local test server, not other private networks. Default requests use GET/HEAD and configured read-only prefixes. Checkout requires the separate opt-in above; account/order/payment routes stay blocked. Service workers, WebSockets, downloads and popups are disabled/closed. Path `/` permits only the root; other prefixes permit descendants. Configure required static assets explicitly. Query keys require the configured search key or `readOnlyQueryRules`, including on checkout pages. Unknown keys stay blocked and standard UTM attribution parameters are removed. Unsupported storefronts fail rather than widen access.

The renderer captures bounded visible text, discovered links and literal Product JSON-LD. Recommendation requires an inspected page with exactly one JSON-LD Product. ProductGroup offer URLs become discovered links; inspecting an explicit Shopify variant retains that variant. Equal low/high AggregateOffer bounds supply an exact price; a range stays unknown. Missing/ambiguous metadata prevents recommendation. Prices come from observed JSON-LD, not model inventions. Text constraints can be inconclusive. The default slice ends at recommendation/decline without changing carts. Opt-in pre-payment actions are described above. Operators must configure genuinely read-only GET endpoints; unusual state-changing GET semantics are outside this prototype's assumptions.

Trace events have stable IDs, monotonically increasing per-session sequence numbers, timestamps, validated actions, bounded observations, status and detail. Replay is a data/observation replay, not a video recording.

Deterministic checks validate the stopping point, proposed action boundary, expected disposition, selected product and typed constraints. Price/currency evidence can prove a pass or failure. Missing evidence produces `unknown`; text absence is not proof of an excluded property. A fresh independent evaluator receives the scenario, browser observations and selected disposition/product, **not** the shopper conversation, success claims or expected outcome. Its verdict must cite existing observations and assess every hard constraint. A semantic pass cannot override a deterministic failure, and unknown deterministic constraints remain inconclusive. Declines require independent justification; a partial catalog sample alone is insufficient to prove no matching product exists. Logical impossibility scenarios can pass by correctly declining.

Session execution state (`queued/running/completed/failed/interrupted`) is separate from evaluation outcome (`passed/failed/inconclusive`). A `completed` session can fail its goal. A scan completes when its sessions finish, even if some session executions fail; if every session errors, the scan is `failed`. Findings reference trace/evidence IDs and expose `summarySource`; summary-model failures preserve a clearly deterministic fallback finding. Fixtures are labeled throughout and excluded from the real dashboard pass rate.

## Fixtures and verification

Set `GATEWAY_MODEL_MODE=fixture` explicitly to bypass OpenAI for development. The browser still visits the configured storefront, and Supabase authentication still applies. Fixtures propose a comparer archetype and three scenarios, including a logically impossible price constraint. They issue scripted product inspection/stop decisions and **fixture** evaluator verdicts. They are not evidence of AI quality. Missing `OPENAI_API_KEY` in `openai` mode returns 503 `CONFIGURATION_ERROR`; it never enables fixtures implicitly.

For a local storefront, configure an environment with an exact `http://127.0.0.1:PORT` origin and `allowLoopback: true`. Do not expose a developer fixture configuration as a production testing service.

```bash
npm run test:backend
npm run test:bridge
npm run typecheck
npm run build
```

Backend tests start their own local storefront and use real Chromium, explicit fixture model outputs, mocked OpenAI transport failures and isolated temporary storage. They do not need a live API key or Supabase account. Existing UI/auth tests remain under `npm run test:e2e` and retain their existing account/server requirements. Live OpenAI behavior requires a configured account and has not been claimed by fixture tests.

## Frontend bridge

Start on `/discover`: select an authorized test environment, inspect, edit the archetypes/scenarios, check the review confirmation, approve, then run. The UI uses `lib/gateway/client.ts`; no provider or API key is imported by client components. `GET /drafts` lists saved plans and `/discover?draft=ID` resumes review. `GET /scans/:id` supplies progress and partial traces. The root provider keeps the execution request alive during client-side navigation; reloads observe the persisted scan without resubmitting it.

`/dashboard`, `/scan?scanId=ID`, `/sessions`, `/replays/:id`, and `/recommendations` display saved Gateway records. Replay provides event selection, independent evaluation, usage details and JSON export. Core views never replace failures or empty results with mock data. Remaining legacy demo sections are explicitly labeled.

`/api/agent-scan` returns HTTP 410 and `/agent-scan` redirects to Discover. Separately, retained `/api/intake` and `/api/buyers` remain active legacy entry points: both require a verified owner and strict bounded JSON. Buyer requests use the same durable execution budget; fixture mode is explicit and failed live calls never become scripted successes. Legacy page fetching uses exact server-configured origins, safe pinned DNS/IP, no redirects, 4 MB response limits and the read-only path/query policy (checkout is disabled for this fetch tool). The legacy checkout tool itself is a synthetic fixture, not live payment execution. Legacy report GETs require authentication and return immutable labeled fixtures; POST returns 405. Send real evaluator reports to the owner-scoped scan readiness API instead.

## Public demo browser checks

`config/gateway-demo-environments.json` contains explicit read-only policies for Shopify Dawn, Saleor, and J Skis (`https://jskis.com`). Set `GATEWAY_TEST_ENVIRONMENTS` to its compact JSON contents to enable them in Discover. These policies do not allow checkout or storefront account creation. Create the test account in Gateway itself.

Run `GATEWAY_LIVE_STOREFRONTS=1 npx playwright test tests/gateway-live/ --output=test-results/live-storefronts` to check the real isolated browser against the supplied URLs, product/variant inspection, structured prices, and search. This opt-in suite makes no model calls and does not authenticate to Gateway; it is not proof of a completed AI scan. Observations are saved as `observations.json` in the test output. Saleor's supplied pagination cursor can return an empty page; the test follows its observed catalog link to recover.

To exercise the real AI service as well, run `GATEWAY_LIVE_AI=1 npx playwright test tests/gateway-live/ai-workflow.spec.ts --output=test-results/live-ai`. This explicitly opts into billed OpenAI calls on the three configured stores. It loads `.env.local`, uses isolated result storage, validates generated plans, executes sessions, and checks result API handlers. Each synthetic service-test owner (`live-service-test-` plus its environment ID) must be explicitly included in `GATEWAY_LIVE_OWNER_IDS`, with pricing and spend caps configured; the test does not bypass execution admission. It does not create a Supabase account or bypass the running app’s authentication; signup and authenticated UI acceptance remain separate checks. Drafts, scans, traces and model metadata are retained in the test output.

## Quantitative Overview bridge

`GET /api/gateway/dashboard` includes a typed `readiness` object (see `lib/gateway/readiness.ts`). The Overview consumes this input for its score ring, sampled storefront counts, four category cards and trend. Existing scans need no migration or rerun: their persisted observations and independent evaluations are projected at read time.

The overall score is `passed / (passed + failed)` for independently evaluated goals in the latest non-fixture scan. Inconclusive and unevaluated sessions are separate counts; no conclusive results means `score: null`, never an artificial zero. If only fixture scans exist, the entire panel is explicitly labeled. Trends contain at most five completed scans with the same origin, configured environment and fixture status. Different scenario sets can affect comparisons.

Default category measurements are explicitly scoped: Discovery counts sampled browser actions, Security counts proposed-action compliance, and Compatibility counts product observations with exactly one structured product/price/currency. These are not whole-catalog coverage or a storefront security audit. Checkout reports whether the saved environment enabled it and how many checkout actions executed. Historical records without that capability field are labeled unknown. Checkout quality/payment safety remain unmeasured unless a separate evaluator submits relevant checks; executing an action does not manufacture a checkout score.

An independent evaluator or authenticated orchestration service can supply richer category results with `POST /api/gateway/scans/:id/readiness` after the scan stops:

```json
{
  "category": "discovery",
  "producer": "catalog-evaluator-v1",
  "description": "Product discoverability checks in the sampled catalog.",
  "unit": "product checks",
  "checks": [
    {
      "id": "product-navigation",
      "label": "Product reachable from the catalog",
      "result": "pass",
      "evidenceIds": ["<observation-or-trace-event-UUID-from-this-scan>"]
    }
  ]
}
```

Categories are `discovery`, `checkout`, `security`, and `compatibility`; check results are `pass`, `fail`, or `unknown`. The server validates unique check IDs, owner access and evidence references, stamps receipt time, and persists one report per category (later submissions replace that category). It computes scores from checks rather than accepting a supplied percentage. The submitting evaluator is responsible for the factual validity of the checks; reference validation establishes provenance, not truth. Do not submit checkout passes using unrelated observations. Reports cannot change shopper permissions, session verdicts, or the overall goal score. The shopper has no reporting action and cannot grade itself.

`GET /api/gateway/scans/:id/readiness` returns the scan's projected metrics, including evidence IDs and producer labels. Refreshing Overview reads accepted reports immediately. The old global in-memory `/api/discovery`, `/api/checkout`, `/api/security`, and `/api/compatibility` demo adapters do not feed these owner-scoped panels; agent producers should use the scan-specific bridge above.

Legacy buyer responses separately expose `evidenceMode: mixed-live-and-fixture` or `fixture`, with `evaluationMode: shopper-self-report`. Individual live-model tool messages label HTTP observations versus synthetic fixture catalog/policy/checkout data. A `live-llm` mode identifies model execution only; it does not turn synthetic tools into measured merchant evidence or independently validate their success flag.
