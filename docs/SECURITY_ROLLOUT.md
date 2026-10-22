# Staff access and public check-in rollout

Vite builds do not apply these migrations, create staff memberships or deploy
Edge Functions. Coordinate the SQL, functions and frontend as described below.
Deploying only the login page does **not** secure the Data API.

## Result

- The workstation mounts only after Supabase verifies a session and an active
  `staff_members` record. Local PINs, browser identities and editable
  `user_metadata.role` cannot authorize staff.
- Staff can work with CRM records at both stores, matching the current workflow.
  Admins manage prices, appointment settings and Clover. Store-specific staff
  assignments are not introduced in this change.
- Both sign-in choices survive refresh. The unchecked default uses tab session
  storage. “Keep me signed in on this trusted device” opts into persistent local
  storage so a later browser session can restore login. This is a remembered
  Supabase session, not a device whitelist or a permanent authentication bypass.
  Token expiry, membership revocation and sign-out still apply. Some browsers
  restore tab storage when restoring a closed session; use Lock on shared desks.
- Visitors can read repair prices, submit a check-in and submit a new website
  quote. They cannot list, retrieve, edit or delete CRM records. The check-in
  endpoint returns only `{ok: true}`.
- Check-in validates a Turnstile challenge on the server and checks hostname and
  action. A service-only transaction matches an existing phone/location or
  creates a customer, then inserts a ticket. Existing identity and consent are
  never overwritten by a public caller. Marketing is unchecked by default.
- Receipt IDs prevent retry duplicates. A database lock enforces limits of
  three submissions per phone and 120 total per ten minutes. Check-in does not
  send SMS. Keep the private receipt table out of any exposed schema list.
- Privileged functions require verified staff/admin membership or an explicit
  server credential. Twilio inbound requests require the official signature
  validator; Meta verification fails closed if its secret is missing.
- Clover tokens are inaccessible to browser queries, including admins. The UI
  reads only connection metadata; mutations run through the admin-only function.

## Review the real schema first

The tests use an isolated PostgreSQL fixture, not the production database.
Export the live schema/policies/grants and back up data before applying SQL.
Confirm the columns used in the two migrations exist in `customers`, `tickets`,
`integration_settings` and `repair_prices`. Optional feature tables are skipped
if absent. Confirm the application is using this repository's Supabase project.

Inventory **all** exposed schemas, tables, views, functions and storage buckets.
The policy migration covers the CRM tables referenced by this repository. It
cannot discover unpublished dashboard changes. Views that bypass RLS and RPCs
in another exposed schema need separate review. The migration revokes browser
execution of legacy public SECURITY DEFINER functions, then grants the private
membership helpers explicitly; verify no unrelated integration relies on those
legacy RPCs. PostgreSQL trigger entry points are not direct browser RPCs.

The Shopify form at https://elitephonerepairtx.net/ writes directly to `quotes`.
Apply `20261022050445_public_quote_intake.sql` in the same transaction as the
staff restrictions. It grants anonymous INSERT on only the form's ten columns,
validates length/phone/location/status, and grants no SELECT, UPDATE or DELETE.
Server-managed IDs, timestamps and prices cannot be supplied. A private trigger
serializes limits of three requests per phone and 120 total per ten minutes.
This preserves the current form without a Shopify theme change. It does not
add a bot challenge: moving quotes to a challenged server endpoint remains a
follow-up. The site's optional photo upload currently targets a nonexistent
`quote-photos` bucket; do not create a public upload bucket as a security shortcut.
Other external booking forms still require a separate inventory.

Historical root SQL scripts use open policies. Do not rerun them after these
migrations. Future migrations must preserve the restricted grants and policies.

## Prepare accounts without locking out staff

1. Use a staging Supabase project first. Disable public self-signup if it is not
   needed by another application. Do not automatically promote existing Auth users.
2. Apply `supabase/migrations/202610220001_staff_access.sql` and
   `202610220002_public_check_in.sql`, then the public quote migration above.
   For a coordinated live cutover, combine all three in a single transaction.
   `20261022050810_staff_access_bootstrap.sql` is an optional idempotent subset
   that prepares memberships before tightening existing CRM tables. It contains
   no account IDs or automatic role assignments.
3. Create staff email/password accounts through Supabase Auth's administrator
   interface. Set initial passwords securely; never put passwords in Git or chat.
4. Use the SQL Editor/service administration to add each approved Auth user UUID
   to `public.staff_members` with `name`, `role` (`admin` or `staff`) and `active=true`.
   Confirm at least one manager and one staff account work before production.
   There is intentionally no browser endpoint for granting roles.
5. For revocation, set the membership's `active=false` and revoke Auth sessions as
   appropriate. Database access and privileged functions check membership on each
   operation; the UI rechecks on focus and refreshed sessions.

## Configure staging secrets and URLs

Frontend build environment:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Staging project's URL while validating; production URL at cutover |
| `VITE_SUPABASE_ANON_KEY` | Matching public anon key; never a service key |
| `VITE_TURNSTILE_SITE_KEY` | Public site key for the approved check-in hostname |

The existing project remains the fallback if the first two settings are absent.
Set both explicitly on staging previews before using any staging credentials.

Supabase Edge Function secrets (never put these in frontend build variables):

| Name | Purpose |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Server-side challenge verification |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Comma-separated exact hostnames, no scheme |
| `PUBLIC_CHECK_IN_ORIGINS` | Comma-separated exact origins including scheme |
| `TWILIO_SMS_WEBHOOK_URL` | Exact external receive-sms URL configured in Twilio, including any query string |
| `TWILIO_AUTH_TOKEN` | Existing Twilio signing credential |
| `META_APP_SECRET` | Existing Meta webhook signing credential |
| `CRM_WORKER_SECRET` | Optional independent scheduler/webhook secret |

Supabase injects its URL/service key for Edge Functions. Keep all existing
Twilio/Clover/Meta secrets. Workers and quote database webhooks must send either
`Authorization: Bearer <service-role-key>` or a valid gateway JWT plus
`x-crm-worker-secret: <CRM_WORKER_SECRET>`. The public anon key alone is denied.
The automation worker now uses its server credential when calling send-sms.
Never give worker/service credentials to browsers.

For the existing quote trigger and scheduled-campaign job, provision Vault names
`crm_project_url` (public URL), `crm_anon_key` (public gateway JWT) and
`crm_worker_secret` (matches Edge `CRM_WORKER_SECRET`). Apply
`20261022051331_authenticated_worker_calls.sql` before enabling guarded workers.
Its private header helper is unavailable to browser roles. The migration keeps
the existing cron schedule, supplies a correctly spaced Bearer header plus the
private worker credential, and fixes/restricts the quote trigger's search path.

Deploy the shared helpers and **all changed functions** together using the root
`supabase/config.toml`. Inbound webhooks and public-check-in have gateway JWT
verification disabled because their handlers verify the provider/challenge.
All privileged browser/worker functions keep gateway JWT verification enabled
and also perform handler authorization. Test the exact deployed gateway mode
against the project's JWT signing configuration; do not disable it as a shortcut.

Public links remain `/?view=kiosk&location=Beaumont`,
`/?view=kiosk&location=Houston`, and `/?view=quote_widget`.
Missing challenge configuration intentionally disables public submissions.
The header's kiosk action signs the workstation out before opening public mode.

## Staging acceptance checks

- Incognito: no customer directory, staff queries or realtime subscriptions.
- Direct anon Data API requests: no CRM reads/writes; only public prices readable.
- Ordinary Auth account and disabled staff: no CRM rows and no privileged functions.
- Staff: customer/ticket/appointment workflows work; admin settings are denied.
- Admin: settings work; direct `access_token` reads and browser role changes fail.
- Sign in with each persistence choice, refresh, close/reopen as appropriate,
  lock, then refresh again. Test on the actual shared iPad/browser.
- Submit a verified check-in for new and existing customers; confirm one ticket
  on retry, generic responses and unchanged existing consent/contact details.
- Invalid/expired/misbound challenge, over-limit submissions and forged webhooks fail.
- Test signed Twilio and Meta webhooks; cron jobs; immediate/scheduled SMS;
  appointment reminders; quote notifications; and Clover connection management.
  Use staging provider credentials/test recipients only.

## Production cutover and rollback

After approval, schedule a short maintenance window. Verify backups and the
manager account, apply the SQL, provision memberships, update worker/webhook
headers/secrets and deploy functions plus frontend. SQL-first denies anonymous
access even while the old frontend is still deployed. Expect the old open-access
workstation to stop working during this window; do not reopen anonymous policies.

Verify incognito/direct-API denial and real staff login before ending maintenance.
Do not merge/deploy just the frontend or mark the issue resolved before these
checks. The branch and a Vercel preview cannot prove the live database is secure.

If frontend rollout fails, keep the restricted policies and use a fixed secure
frontend or maintenance page. Do not restore the old public policies as rollback.
Use the database administrator to fix membership/configuration access problems.

## Validation and remaining work

Run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and Deno checks for
changed functions. Tests cover frontend gates, session restoration, endpoint
authorization, body validation, challenge binding, PostgreSQL RLS/permissions,
atomic check-in rollback, idempotency, and submission limits. Live schema,
gateway, provider and staff-account checks above remain mandatory.

The earlier audit's SMS worker claiming/queue consolidation, consent-rule
unification across send paths, delivery status callbacks, paginated data loading,
legacy feature cleanup and existing dependency advisories remain separate work.
This change does not claim to fix those issues or existing data exposure history.

## Approved live preparation, 2026-10-22

The owner approved a live rollout after the account's free-project limit and
Free-plan branching restrictions blocked a hosted staging database. A local
encrypted backup of all 21 public CRM tables, schema/access metadata, triggers
and cron definitions was captured before permanent access changes. Its encryption
round trip and row counts were verified; it excludes Auth and Storage data.
Eight existing function bundles were backed up separately with authenticated
encryption. Recovery keys and backups are outside this repository.

A real-schema transaction rehearsal passed for staff permissions, the exact
Shopify quote INSERT and the approved administrator identity, then rolled back.
The website notification trigger was disabled only inside that rehearsal so no
test notifications were sent. Customer/ticket/quote counts remained 3286/4134/79
and no rehearsal quote remained. The owner subsequently confirmed the real
account can enter the preview CRM and remain signed in after refresh.

The bootstrap membership and authenticated-worker migrations were applied and
verified. Browser roles cannot execute the worker-header helper or quote-trigger
RPC. The final access-policy/function/frontend cutover still requires completion
and direct HTTP verification; these preparation checks alone are not a release.

## Live read-only preflight

The connected project matches the repository project reference. Read-only
inspection confirmed one email-confirmed Auth account and no staff membership
table yet. Open anonymous policies are still deployed; no migration was applied.
There are no public views in the inspected schema.

The live schema also contains Facebook inbox tables and a customer deduplication
archive. The draft now protects the inbox tables and limits the archive to
admin reads. Public SECURITY DEFINER `notify_new_quote_fn` is executable by
browser roles and has an unset search path; the draft revokes its browser
execution, but its trigger/webhook credential configuration still needs review.

Live pricing uses `issue` plus numeric `price`, whereas the repository SQL uses
`category` plus text/tier prices. Check-in now supports either layout without
rewriting price records. The quote widget can read both shapes; the Settings
price editor still requires separate schema reconciliation before managers edit
legacy price rows. Do not apply the root price-seed SQL over live pricing.

Additional live advisories, not changed by this draft:

- [Privileged public function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- [Mutable function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- [Leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [MFA options](https://supabase.com/docs/guides/auth/auth-mfa).
- [Missing foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys): seven notices, including tickets.customer_id. Review query plans before changes.

The table listing reports RLS enabled throughout; that is not enough when its
policies grant all operations to anon. Live policies confirmed the open access.
