# Security boundaries and known limits

This is source for a locally reviewed, single-process prototype. Passing automated checks does not establish production readiness or authorize running an unrestricted public service.

## Implemented controls

- Middleware and protected route handlers require verified Supabase authentication. Missing configuration fails closed.
- Drafts, scans, sessions, and evidence are accessed through owner-scoped APIs; account profiles have owner-only SQL policies.
- JSON requests are bounded and schema-validated. Workspace/account responses are private and not cached.
- Operators define exact storefront origins, allowed paths/query parameters, and explicit staging adapters. Browser and legacy HTTP reads constrain destinations, redirects, IP addresses, response size, and actions.
- Draft edits and environment-policy changes require a new review/approval cycle.
- Cart writes require the exact observed product and a matching one-use request grant. Payment entry and completed purchases are outside the documented release claim.
- Owner/global job and model-call quotas are persisted. Model attempts reserve a conservative maximum cost before transport; failed attempts do not refund uncertain charges.
- Shopper output does not grant permissions. Deterministic failures cannot be converted to passes by a semantic evaluator.

## Operator responsibilities

Run one Node process with a persistent private data directory. Filesystem permissions, safe disk capacity, backups, retention, crash recovery, trusted configuration, and model-pricing accuracy remain operator responsibilities. Do not expose the data directory as static content. The package scripts can listen on all interfaces; use `--hostname 127.0.0.1` for local review.

Only configure storefronts you own or are authorized to test. An allowed URL is not proof that a merchant's endpoint is read-only. Checkout adapters belong on safe development/staging environments. Public demonstration domain examples do not grant automation permission.

Use a Supabase publishable key in browser-visible configuration. Keep model and service-role/secret keys server-side and out of source. This application does not require a Supabase service-role key. Keep `.env.local`, browser storage states, `.gateway-data/`, generated builds, logs, and test traces out of Git. Never paste real customer data into fixture records.

## Acceptance gaps

The fixture suite uses synthetic identity and model outputs. It does not verify hosted Supabase migrations/RLS, email ownership settings/delivery, real account lifecycle, live model quality or billing, arbitrary merchant safety, or distributed execution. Hosted two-user isolation and real-account acceptance require a separately configured authorized environment.

Google/SSO/password recovery are unavailable as documented. Legacy reports and some retained screens contain labeled demo data. Local frame captures are snapshots, not video. Source publication and service deployment are separate decisions.

## Reporting an issue

Do not post credentials, personal data, private traces, or exploitable sensitive details in a public issue. Contact the repository maintainer through a verified private channel or GitHub private vulnerability reporting if it is enabled. No response-time commitment or hosted support service is offered by this prototype.
