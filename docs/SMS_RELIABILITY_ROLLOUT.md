# SMS reliability and consent rollout

Scope: prevent concurrent/retried sends and enforce recorded consent consistently.
Pricing, broad pagination and dependency upgrades are separate work.

## Behavior

- Manual messages, scheduled campaigns, automation SMS nodes and appointment
  workers all use `_shared/smsDispatch.ts`.
- The service-only `crm_prepare_sms_dispatch` RPC checks the current destination's
  consent using indexed phone lookups, reserves a durable key and writes a queued message in one transaction
  before Twilio is contacted. A provider response is recorded transactionally.
- Marketing and transactional messages each require their corresponding consent
  flag to be explicitly true. Open tickets never override false/missing consent.
  Unknown contacts need recorded permission before outbound texts can be sent.
- Any global revocation on a matching contact, including alternate/duplicate phone records, or
  phone-level STOP blocks dispatch. The existing UI's marketing-only revocation
  marker respects the individual consent flags; it does not block permitted repair
  updates. Existing consent flags and history are preserved. Merely saving a customer does not grant consent.
- Signed STOP callbacks persist a block even for an unknown phone. Standard opt-out
  aliases and Twilio's `OptOutType` are respected. START restores transactional
  permission; it does not opt someone into marketing. Twilio supplies its own
  opt-out confirmations; this handler returns empty TwiML for those keywords.
- Twilio callback IDs are recorded once, atomically with consent and inbound logs.
  Existing callback IDs are backfilled so an old replay cannot reverse a later START.
- Combined promotional/transactional bodies require marketing permission and send
  once as marketing, rather than duplicating the full body under two labels.
- Campaigns deduplicate per normalized phone, not just customer ID. Appointment
  keys identify the appointment/version/job type. Automation keys identify the
  enrollment/node. Browser retries retain their send key after an uncertain result.
- Database `UPDATE ... RETURNING` claims with `FOR UPDATE SKIP LOCKED` ensure each
  worker processes only its own claimed rows. The browser appointment processor
  delegates to the server rather than maintaining a second sender.
- Existing `sending` campaigns and claimed/locked jobs are never automatically
  reclaimed. Interrupted work requires review; automatic replay could send twice.
- Network errors, provider 5xx responses and lost outcome writes are uncertain.
  The receipt prevents another provider request. The inbox records an explanatory
  failure when possible; a lost final write may leave a queued message/dispatching
  receipt. A successful Twilio API response means accepted, not confirmed delivered.
- Appointment reminders for past appointment dates, or jobs over 24 hours late,
  are skipped. This prevents stale reminders from being dispatched on worker startup.

## Verification

`tests/smsDispatch.test.ts` runs the actual migration in embedded Postgres and calls
actual dispatch code with a stub provider: parallel requests, ambiguous outcomes,
failed final writes, strict consent, duplicate contacts, STOP/START, callback replay,
service-role permissions and exclusive queue claims. The provider is never contacted
by these tests. Browser tests cover stable retry keys, active-ticket opt-out bypass,
combined messages, appointment delegation and stale reminders.

Before release, rehearse migration and service-role dispatch RPCs in a live database
transaction that rolls back, without contacting Twilio. Verify customer/ticket/quote
counts and browser/public API permissions remain intact. Verify the production
Vercel team/project/commit and keep existing webhook signature verification enabled.

## Release and recovery

1. Record the existing five Edge Function versions and preserve their source.
2. Apply the additive database migration; verify the service-only grants and RLS.
3. Deploy the shared-gate workers, inbound webhook and `send-sms`. Deploy the tested
   frontend from GitHub main. Old browser sends without a retry key fail closed and
   instruct staff to refresh. Do not disable authentication during deployment.
4. Verify unsigned callbacks/public worker calls still fail. Use rollback-only
   database probes for positive consent and receipt tests; do not send test campaigns
   to real customers. The known September appointment reminder should be skipped.
5. Check logs and receipt/job state after rollout. Do not silently reset `sending`,
   `claimed`, locked enrollments, dispatching or uncertain receipts to pending.

For an interrupted run: compare receipt/provider IDs and the Twilio message history
before deciding whether a send occurred. Keep completed receipts. Reconcile an
ambiguous outcome only with provider evidence; do not delete a receipt to retry.
A new intentional send must use a new key after that review. The old handlers and
browser sender bypass consent/idempotency; restoring them is not a safe rollback.
Keep the database receipts/blocks and repair the shared gate instead.

Known limits: this is at-most-once provider submission per durable key, not an
exactly-once delivery guarantee. A crash after reservation but before submission
can hold an unsent message for review. Staff create a new campaign for a new blast;
keys do not suppress a separately intended campaign. SMS delivery-status callbacks,
quiet-hours redesign and durable campaign resumption are separate follow-ups.
