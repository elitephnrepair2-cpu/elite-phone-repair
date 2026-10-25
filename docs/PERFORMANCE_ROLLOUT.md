# CRM performance changes

## Evidence and scope

The previous workspace fetched all five datasets after every subscribed table
change, including every SMS message. Each focus membership check also unmounted
and rebuilt the workstation. Secondary screens were imported into the staff
startup chunk. The customer table rendered every row, and its text search matched
all phone numbers when the query had no digits.

This release:

- Keeps a verified workstation mounted during same-token background focus checks.
  Changed tokens still require verification; revoked membership still removes access.
- Refreshes only affected datasets, combines realtime bursts over 200 ms and allows
  only one in-flight request per table, with one follow-up when a change arrives.
- Removes workspace-wide SMS subscriptions and duplicate browser appointment-reply
  processing. The SMS inbox retains its own updates; signed server callbacks handle
  replies and emit appointment changes to the appointment subscription.
- Fetches complete, location-scoped history in ordered pages. Independent remaining
  pages load with concurrency capped at three. Ticket responses no longer repeat
  whole customer records: a local map joins contacts and missing cross-store IDs
  are fetched once per batch of 200. Related contacts load before ticket actions.
- Keeps prior valid data on a failed refresh, provides Retry and ignores disposed
  location requests. Subscription reconnects reconcile missed changes.
- Loads secondary screens on demand, with a screen loading/error boundary.
- Builds Tailwind styles ahead of time. Removes the unused global Supabase SDK,
  unused spreadsheet runtime, unused external React import map and unused font
  download. Tailwind 3.4.19 is pinned with patched selector-parser 7.1.6.
- Renders customer-table pages of 50 records; search still covers the complete
  directory, including older records. Fixes non-digit phone matching and groups
  front-desk active tickets once instead of filtering all tickets per customer row.

No database schema, RLS, SMS provider configuration, credentials or customer records
are changed by this release. Full-history first visits remain supported; this is
not a server-side search/pagination migration. A later redesign can fetch only
visible history once analytics and campaign audiences have separate complete queries.

## Measured build output

Previous production staff-workspace JS chunk: 314.53 kB raw / 68.78 kB gzip.
Updated chunk: approximately 74.8 kB raw / 19.0 kB gzip (about 76% smaller raw).
This is the staff-workspace chunk, not a claim that every page or network request
is 76% faster. Shared entry JS remains approximately 377 kB. Generated CSS is about
82 kB raw / 12.9 kB gzip and replaces browser-time CSS generation and CDN scripts.

## Validation

- 141 automated tests passed, TypeScript checking and the production build passed.
- Tests cover complete paging, concurrent table refreshes, burst coalescing,
  in-flight follow-ups, disposed locations, scoped store switching, cross-store
  contact hydration, failed-refresh preservation and unauthorized-session locking.
- Access tests verify focus revalidation does not remount the workstation and that
  changed tokens or revoked membership cannot reuse old authorization.
- Customer-table tests verify 50-row rendering, navigation to all records and
  complete email/name search without matching empty phone digits.
- A separate read-only local browser fixture opened the actual app/components with
  1,500 sample customers and 2,501 sample tickets. Search reached the final customer;
  linked ticket details, customer-page navigation and email search worked. Switching
  stores removed the previous store's directory and switching back restored it.
  Compiled styles rendered correctly; no browser warnings/errors were reported.
  All fixture writes and messaging were disabled; no production credentials were
  used. Fixture files live outside the repository and are not deployed.
- The dependency report retains the existing eight advisories (one low, one moderate,
  six high). The new style tooling adds no unresolved advisories after the parser pin.

## Release verification and rollback

Require the GitHub/Vercel build to pass for the exact release tree. After merge,
verify production domain, commit and READY status; verify its HTML references the
compiled CSS and no removed runtime CDN scripts. Confirm public data access and
webhook protection remain enforced. Refresh old browser tabs once after release.

This frontend-only release can be rolled back to the preceding deployment without
reverting the prior database/login/SMS security protections. Do not reset consent,
open anonymous policies or roll back protected server handlers for a UI regression.
