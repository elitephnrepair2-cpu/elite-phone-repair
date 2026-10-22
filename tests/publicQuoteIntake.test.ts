import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const adminId = '00000000-0000-4000-8000-000000000002';
const insert = (phone = '(409) 555-1212', changes: Record<string, unknown> = {}) => {
  const values = { customer_name: 'Website Customer', phone, email: null, brand: 'Apple',
    model: 'iPhone 12', issue: 'Screen Damage', notes: 'Device Type: Phone', is_manual: false,
    status: 'new', location: 'Beaumont', ...changes };
  return db.query(`INSERT INTO public.quotes (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map((_,i) => `$${i+1}`).join(',')})`, Object.values(values));
};
async function asRole<T>(role: string, uid: string, action: () => Promise<T>) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
  try { return await action(); } finally { await db.exec('RESET ROLE'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE public.quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),customer_name text,phone text,email text,
      brand text,model text,issue text,notes text,price numeric,is_manual boolean,status text,location text);
    GRANT ALL ON public.quotes TO anon,authenticated,service_role;
    ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_open ON public.quotes FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
  `);
  await db.exec(readFileSync('supabase/migrations/202610220001_staff_access.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261022050445_public_quote_intake.sql','utf8'));
  await db.query('INSERT INTO auth.users VALUES ($1)', [adminId]);
  await db.query("INSERT INTO public.staff_members(user_id,name,role) VALUES ($1,'Manager','admin')",[adminId]);
}, 30000);
afterAll(async () => { await db?.close(); });

it('accepts the exact public website insert without granting quote reads or edits', async () => {
  await asRole('anon','', async () => {
    await expect(insert()).resolves.toBeDefined();
    await expect(db.query('SELECT * FROM public.quotes')).rejects.toThrow(/permission denied/);
    await expect(db.query("UPDATE public.quotes SET status='done'")).rejects.toThrow(/permission denied/);
    await expect(db.query('DELETE FROM public.quotes')).rejects.toThrow(/permission denied/);
  });
  expect((await db.query('SELECT count(*)::int AS n FROM public.quotes')).rows).toEqual([{n:1}]);
});
it.each(['id','created_at','price'])('denies public writes to server-managed %s', async column => {
  const value = column === 'id' ? adminId : column === 'created_at' ? '2020-01-01' : 0;
  await asRole('anon','', async () => {
    await expect(insert('7135551212',{[column]:value})).rejects.toThrow(/permission denied/);
  });
});
it.each([{status:'done'},{is_manual:true},{location:'Other'},{brand:''},{phone:'invalid'},{notes:'x'.repeat(4001)}])('rejects an invalid public payload %j', async changes => {
  await asRole('anon','', async () => {
    await expect(insert('7135551212',changes)).rejects.toThrow(/row-level security|Invalid quote/);
  });
});
it('enforces the per-phone allowance despite formatting variations', async () => {
  await asRole('anon','', async () => {
    await insert('4095551212');
    await insert('+1 409 555 1212');
    await expect(insert('(409) 555-1212')).rejects.toThrow(/temporarily unavailable/);
  });
});
it('keeps staff quote creation available with prices and manual statuses', async () => {
  await asRole('authenticated',adminId, async () => {
    await expect(insert('(409) 555-1212',{price:99,is_manual:true,status:'contacted'})).resolves.toBeDefined();
    expect((await db.query('SELECT * FROM public.quotes')).rows).toHaveLength(4);
  });
});
it('keeps the privileged trigger out of public RPC access', async () => {
  await asRole('anon','', async () => {
    await expect(db.query('SELECT crm_private.limit_public_quote_insert()')).rejects.toThrow(/permission denied/);
  });
});
it('enforces the global allowance for different phone numbers too', async () => {
  await asRole('authenticated',adminId, async () => {
    for (let i=0;i<116;i++) await insert('7135551212');
  });
  await asRole('anon','', async () => {
    await expect(insert('2815551212')).rejects.toThrow(/temporarily unavailable/);
  });
});
