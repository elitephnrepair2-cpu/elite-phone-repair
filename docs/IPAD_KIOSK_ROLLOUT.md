# Houston iPad: staff/customer handoff

On the iPad, sign in with the approved administrator account, choose Houston, then
choose Customer check-in. First use asks the owner to choose and confirm a private
six-digit return PIN. The owner submits that setup themselves; do not ask for the
PIN or password in chat. Pairing lasts 30 days. Later handoffs need Start check-in;
Return to staff dashboard accepts the PIN or the regular staff password.

## Access boundaries

- A random 256-bit device capability permits only check-in submission and a
  rate-limited PIN verification attempt. It is bound to one location and owner,
  expires after 30 days, and is revocable. Only an active administrator can enroll.
- Entering customer mode first locks the current Supabase session ID in the
  database, then clears its local/remote staff login and replaces the page.
  RLS and privileged Edge Functions deny the suspended JWT even if a stale tab,
  Back navigation or a copied access token retains it. The client handoff flag
  also masks every staff route on startup, storage changes and pageshow.
- Customer mode uses a separate non-persistent anonymous client. It cannot query
  customers/tickets/settings. The location is taken from the device record, not
  a submitted form field. The existing public CAPTCHA endpoint remains separate
  and fail-closed; pairing does not open public anonymous data policies.
- PIN hashes use salted PBKDF2-SHA256 with 600,000 iterations. The server reserves
  attempts atomically; five attempts trigger a 15-minute block. There is no default
  PIN and no client-side PIN comparison. The staff password remains a fallback.
- Correct PIN verification authorizes a new session for the bound, still-active
  account using a server-generated one-time Auth token. No email is sent. A separate
  Auth client verifies it so service privileges never leak into a browser session.
  The session is bound to the device; revocation/expiry also blocks that PIN session.
- Check-in is validated, rate-limited and idempotent. The existing atomic intake
  transaction creates a customer only if needed and one ticket, and never changes
  an existing customer's identity or revoked consent. It now records source iPad,
  a value accepted by the live schema. No matching IDs/records are returned.
- The form clears after success. Old staff-side intake and client PIN exit paths
  are no longer used. Password fallback requires verified staff membership before
  removing the handoff mask. Removing an expired pairing is possible locally.

## Deployment and verification

Run the SQL in embedded Postgres and in a rollback-only live-schema rehearsal.
Test old-token RLS denial, new-session access, anonymous RPC denial, owner/location
binding, expiry/revocation, PIN attempt locks, consent preservation and idempotency.
Test the handler with Auth/provider stubs; wrong PINs must never mint sessions.
Verify sign-out clears storage and direct staff routes cannot bypass handoff mode.

Apply the migration before deploying the new kiosk-device function and ALL nine
privileged functions that import the updated authorization helper. Keep verify_jwt
on for those nine functions. kiosk-device has its own staff/device/PIN checks and
uses verify_jwt=false. CORS defaults to the exact live CRM origin. Deploy the tested
frontend after the backend guards. Never provision a real pairing on the Mac as
proof that the Houston iPad is configured: setup must happen on the physical iPad.

No customer data or real pairing should remain from rollback-only rehearsals.
Verify normal unpaired staff sessions still have access, public API reads stay
blocked, and the public CAPTCHA endpoint remains unavailable without verification.
Keep source snapshots of the prior functions and the migration/release identity.

Do not delete device/session-lock history to fix a login problem: that could
reactivate an old access token. Revoke the device or use staff password sign-in
for a fresh session. Browser pairing removal does not make a revoked device usable.
Use ordinary iPad device locking/Guided Access as an additional physical safeguard;
the app cannot disable Safari, saved-password UI or operating-system gestures.
