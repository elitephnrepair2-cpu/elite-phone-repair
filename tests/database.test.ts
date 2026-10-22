import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const ids = { staff: '00000000-0000-4000-8000-000000000001', admin: '00000000-0000-4000-8000-000000000002',
  outsider: '00000000-0000-4000-8000-000000000003', disabled: '00000000-0000-4000-8000-000000000004' };
const fixture = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(),
    name text NOT NULL, phone text NOT NULL, email text, alt_phone text, location text,
    transactional_sms_consent boolean, marketing_sms_consent boolean,
    transactional_sms_consent_at timestamptz, marketing_sms_consent_at timestamptz,
    consent_source text, consent_method text, consent_form_version text,
    revoked_at timestamptz, revoked_reason text
  );
  CREATE TABLE public.tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.customers(id),
    device text NOT NULL, problem_description text NOT NULL, heard_from text, location text,
    repair_type text, estimated_cost text
  );
  CREATE TABLE public.integration_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text, access_token text,
    is_connected boolean, merchant_id text, selected_device_id text
  );
  CREATE TABLE public.repair_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand text, model text, category text, price text
  );
  CREATE TABLE public.facebook_conversations (id uuid DEFAULT gen_random_uuid());
  CREATE TABLE public.facebook_messages (id uuid DEFAULT gen_random_uuid());
  CREATE TABLE public.customers_dedupe_archive (id uuid DEFAULT gen_random_uuid());
  INSERT INTO public.facebook_messages DEFAULT VALUES;
  INSERT INTO public.customers_dedupe_archive DEFAULT VALUES;
  CREATE TABLE public.appointments (id uuid DEFAULT gen_random_uuid());
  CREATE TABLE public.sms_messages (id uuid DEFAULT gen_random_uuid());
  CREATE FUNCTION public.legacy_dump() RETURNS SETOF public.customers
    LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.customers $$;
  INSERT INTO public.customers(name,phone,location,marketing_sms_consent,transactional_sms_consent,revoked_reason)
    VALUES ('Existing Customer','(409) 555-1212','Beaumont',false,false,'STOP');
  INSERT INTO public.integration_settings(provider,access_token,is_connected) VALUES ('clover_beaumont','private-token',true);
  INSERT INTO public.repair_prices(brand,model,category,price) VALUES('Apple','iPhone 12','Screen','$100');
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY legacy_world_access ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
`;
const payload = { name: 'Changed Name', phone: '(409) 555-1212', email: 'changed@example.test', callBackNumber: '',
  location: 'Beaumont', device: 'Apple iPhone 12', deviceBrand: 'Apple', deviceModel: 'iPhone 12',
  repairCategory: 'Screen', problemDescription: 'Broken screen', heardFrom: 'Other',
  transactionalConsent: true, promotionalConsent: true };
const submit = (id: string, changes = {}) => db.query('SELECT public.crm_submit_check_in($1,$2::jsonb)', [id, JSON.stringify({ ...payload, ...changes })]);
async function asRole<T>(role: string, user: string, action: () => Promise<T>) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  try { return await action(); } finally { await db.exec('RESET ROLE'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(fixture);
  await db.exec(readFileSync('supabase/migrations/202610220001_staff_access.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610220002_public_check_in.sql', 'utf8'));
  for (const [role, id] of Object.entries(ids)) {
    await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
    if (role !== 'outsider') await db.query('INSERT INTO public.staff_members(user_id,name,role,active) VALUES ($1,$2,$3,$4)',
      [id, role, role === 'admin' ? 'admin' : 'staff', role !== 'disabled']);
  }
}, 30000);
afterAll(async () => { await db?.close(); });

it('removes legacy anonymous policies and denies all customer access to anon', async () => {
  await asRole('anon','', async () => {
    await expect(db.query('SELECT * FROM public.customers')).rejects.toThrow(/permission denied/);
    await expect(db.query("INSERT INTO public.customers(name,phone) VALUES ('attacker','4095555555')")).rejects.toThrow(/permission denied/);
    await expect(db.query('SELECT * FROM public.legacy_dump()')).rejects.toThrow(/permission denied/);
  });
});
it.each(['outsider','disabled'] as const)('denies %s accounts even with a valid Auth identity', async kind => {
  await asRole('authenticated', ids[kind], async () => {
    expect((await db.query('SELECT * FROM public.customers')).rows).toHaveLength(0);
    await expect(db.query("INSERT INTO public.customers(name,phone) VALUES ('attacker','4095555555')")).rejects.toThrow(/row-level security/);
    expect((await db.query('SELECT crm_private.crm_is_staff() AS allowed')).rows[0]).toEqual({ allowed: false });
  });
});
it('allows approved staff but prevents self-promotion and private RPC calls', async () => {
  await asRole('authenticated', ids.staff, async () => {
    expect((await db.query('SELECT * FROM public.customers')).rows.length).toBeGreaterThan(0);
    await expect(db.query("UPDATE public.staff_members SET role='admin'")).rejects.toThrow(/permission denied/);
    await expect(submit('11111111-1111-4111-8111-111111111111')).rejects.toThrow(/permission denied/);
    await expect(db.query('SELECT * FROM public.legacy_dump()')).rejects.toThrow(/permission denied/);
  });
});
it('keeps integration tokens unreadable even to admin browser sessions', async () => {
  await asRole('authenticated', ids.admin, async () => {
    expect((await db.query('SELECT provider,is_connected FROM public.integration_settings')).rows).toHaveLength(1);
    await expect(db.query('SELECT access_token FROM public.integration_settings')).rejects.toThrow(/permission denied/);
    await expect(db.query("UPDATE public.integration_settings SET access_token='changed'")).rejects.toThrow(/permission denied/);
  });
});
it('preserves public price reads while denying public writes', async () => {
  await asRole('anon','', async () => {
    expect((await db.query('SELECT price FROM public.repair_prices')).rows).toEqual([{ price: '$100' }]);
    await expect(db.query("UPDATE public.repair_prices SET price='$0'")).rejects.toThrow(/permission denied/);
  });
});
it('protects the live Facebook tables and restricts the archive to manager reads', async () => {
  await asRole('anon','', async () => {
    await expect(db.query('SELECT * FROM public.facebook_messages')).rejects.toThrow(/permission denied/);
    await expect(db.query('SELECT * FROM public.customers_dedupe_archive')).rejects.toThrow(/permission denied/);
  });
  await asRole('authenticated',ids.outsider, async () => {
    expect((await db.query('SELECT * FROM public.facebook_messages')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM public.customers_dedupe_archive')).rows).toHaveLength(0);
  });
  await asRole('authenticated',ids.staff, async () => {
    expect((await db.query('SELECT * FROM public.facebook_messages')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.customers_dedupe_archive')).rows).toHaveLength(0);
  });
  await asRole('authenticated',ids.admin, async () => {
    expect((await db.query('SELECT * FROM public.customers_dedupe_archive')).rows).toHaveLength(1);
    await expect(db.query('DELETE FROM public.customers_dedupe_archive')).rejects.toThrow(/permission denied/);
  });
});
it('keeps privileged helpers outside the exposed schema', async () => {
  expect((await db.query("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname LIKE 'crm_%'")).rows).toHaveLength(0);
  await asRole('authenticated',ids.staff, async () => {
    await expect(db.query('SELECT * FROM crm_private.intake_receipts')).rejects.toThrow(/permission denied/);
    await expect(db.query('SELECT crm_private.crm_submit_check_in($1,$2::jsonb)', ['11111111-1111-4111-8111-111111111111', JSON.stringify(payload)])).rejects.toThrow(/permission denied/);
  });
});
it('creates a ticket once without letting public check-in overwrite customer identity or consent', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  await asRole('service_role','', async () => { await submit(id); await submit(id); });
  expect((await db.query('SELECT name,email,marketing_sms_consent,transactional_sms_consent,revoked_reason FROM public.customers')).rows[0])
    .toEqual({ name: 'Existing Customer', email: null, marketing_sms_consent: false, transactional_sms_consent: false, revoked_reason: 'STOP' });
  expect((await db.query('SELECT device,estimated_cost FROM public.tickets')).rows).toEqual([{ device: 'Apple iPhone 12', estimated_cost: '$100' }]);
});
it('rolls back customer creation and receipt if ticket creation fails', async () => {
  await db.exec("ALTER TABLE public.tickets ADD CONSTRAINT test_bad_device CHECK (device <> 'FAIL')");
  await asRole('service_role','', async () => {
    await expect(submit('22222222-2222-4222-8222-222222222222', { phone: '4095551213', device: 'FAIL' })).rejects.toThrow();
  });
  expect((await db.query("SELECT * FROM public.customers WHERE phone='(409) 555-1213'")).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM crm_private.intake_receipts WHERE request_id='22222222-2222-4222-8222-222222222222'")).rows).toHaveLength(0);
});
it('creates a new customer with explicitly supplied consent and limits repeated submissions', async () => {
  await asRole('service_role','', async () => {
    for (const n of [3,4,5]) await submit(`00000000-0000-4000-8000-00000000000${n}`, { phone: '4095551214', promotionalConsent: false });
    await expect(submit('00000000-0000-4000-8000-000000000006', { phone: '4095551214' })).rejects.toThrow(/temporarily unavailable/);
  });
  const customer = (await db.query("SELECT marketing_sms_consent,transactional_sms_consent FROM public.customers WHERE phone='(409) 555-1214'")).rows;
  expect(customer).toEqual([{ marketing_sms_consent: false, transactional_sms_consent: true }]);
});
it('supports the live legacy issue/numeric pricing layout without rewriting prices', async () => {
  await db.exec("ALTER TABLE public.repair_prices RENAME COLUMN category TO issue; ALTER TABLE public.repair_prices ALTER COLUMN price TYPE numeric USING replace(price,'$','')::numeric;");
  await asRole('service_role','', async () => {
    await submit('66666666-6666-4666-8666-666666666666', { phone: '4095551215' });
  });
  expect((await db.query("SELECT estimated_cost FROM public.tickets t JOIN public.customers c ON c.id=t.customer_id WHERE c.phone='(409) 555-1215'")).rows)
    .toEqual([{ estimated_cost: '$100' }]);
});
