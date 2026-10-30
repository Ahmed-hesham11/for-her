import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Runs the REAL migration file against an in-process Postgres (PGlite) with a
// minimal stand-in for the orders / order_items tables. PGlite is a single
// connection, so true parallel row locking (FOR UPDATE SKIP LOCKED) can't be
// exercised here; claim semantics (leases, expiry, scheduling) can.

const migration = readFileSync(new URL("../supabase/migrations/20261031000000_meta_event_outbox.sql", import.meta.url), "utf8");
let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role service_role;
    create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now(),
      total_amount numeric not null default 0, customer_name text, phone_1 text, governorate text);
    create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), product_id text, quantity int, unit_price numeric);
    insert into public.orders (user_id, total_amount) values (gen_random_uuid(), 1);
  `);
  await db.exec(migration);
  await db.exec(migration); // re-running must be safe
});

const count = async (where = "true") => Number((await db.query<{ n: string }>(`select count(*) n from public.meta_event_outbox where ${where}`)).rows[0].n);

describe("meta_event_outbox migration", () => {
  test("existing orders are preserved and not backfilled", async () => {
    assert.equal(Number((await db.query<{ n: string }>("select count(*) n from public.orders")).rows[0].n), 1);
    assert.equal(await count(), 0);
  });

  test("a successful order creates exactly one outbox record: event_id = order id, event_time = created_at", async () => {
    const { rows } = await db.query<{ id: string; created_at: Date }>("insert into public.orders (user_id, total_amount) values (gen_random_uuid(), 540) returning id, created_at");
    const ev = (await db.query<{ event_id: string; event_time: Date; status: string; attempts: number; event_name: string }>("select * from public.meta_event_outbox where order_id = $1", [rows[0].id])).rows;
    assert.equal(ev.length, 1); assert.equal(ev[0].event_id, rows[0].id); assert.equal(ev[0].event_name, "Purchase");
    assert.equal(ev[0].status, "pending"); assert.equal(ev[0].attempts, 0); assert.equal(ev[0].event_time.getTime(), rows[0].created_at.getTime());
  });

  test("a failed (rolled-back) order creates no outbox record", async () => {
    const before = await count();
    await db.exec("begin");
    await db.exec("insert into public.orders (user_id, total_amount) values (gen_random_uuid(), 10)");
    await db.exec("rollback");
    assert.equal(await count(), before);
  });

  test("manual orders without a user are not enqueued", async () => {
    const before = await count();
    await db.exec("insert into public.orders (user_id, total_amount) values (null, 10)");
    assert.equal(await count(), before);
  });

  test("duplicates are impossible: unique(order_id, event_name)", async () => {
    const { rows } = await db.query<{ id: string }>("select order_id id from public.meta_event_outbox limit 1");
    await assert.rejects(db.query("insert into public.meta_event_outbox (order_id, event_name, event_id, event_time) values ($1, 'Purchase', 'x', now())", [rows[0].id]));
    const before = await count();
    await db.query("insert into public.meta_event_outbox (order_id, event_name, event_id, event_time) values ($1, 'Purchase', 'x', now()) on conflict do nothing", [rows[0].id]);
    assert.equal(await count(), before);
  });

  test("claim leases each event once; a second worker gets nothing", async () => {
    await db.exec("update public.meta_event_outbox set status='pending', lease_token=null, locked_until=null, attempts=0");
    const total = await count();
    const a = await db.query("select * from public.claim_meta_events(100, 180)");
    const b = await db.query("select * from public.claim_meta_events(100, 180)");
    assert.equal(a.rows.length, total); assert.equal(b.rows.length, 0);
    assert.ok((a.rows as { lease_token: string; attempts: number; status: string }[]).every((r) => r.lease_token && r.attempts === 1 && r.status === "processing"));
  });

  test("a crashed worker's expired lease is reclaimed with a new token", async () => {
    const old = (await db.query<{ lease_token: string }>("select lease_token from public.meta_event_outbox limit 1")).rows[0].lease_token;
    assert.equal((await db.query("select * from public.claim_meta_events(100, 180)")).rows.length, 0);
    await db.exec("update public.meta_event_outbox set locked_until = now() - interval '1 second'");
    const again = await db.query<{ lease_token: string; attempts: number }>("select * from public.claim_meta_events(100, 180)");
    assert.ok(again.rows.length > 0); assert.notEqual(again.rows[0].lease_token, old); assert.equal(again.rows[0].attempts, 2);
  });

  test("scheduled retries wait for next_attempt_at, sent/failed are never claimed, p_order_id filters", async () => {
    await db.exec("update public.meta_event_outbox set status='pending', lease_token=null, locked_until=null, next_attempt_at = now() + interval '1 hour'");
    assert.equal((await db.query("select * from public.claim_meta_events(100, 180)")).rows.length, 0);
    await db.exec("update public.meta_event_outbox set next_attempt_at = now()");
    const target = (await db.query<{ order_id: string }>("select order_id from public.meta_event_outbox limit 1")).rows[0].order_id;
    assert.equal((await db.query("select * from public.claim_meta_events(100, 180, $1)", [target])).rows.length, 1);
    await db.exec("update public.meta_event_outbox set status='sent', locked_until=null");
    assert.equal((await db.query("select * from public.claim_meta_events(100, 180)")).rows.length, 0);
    await db.exec("update public.meta_event_outbox set status='failed'");
    assert.equal((await db.query("select * from public.claim_meta_events(100, 180)")).rows.length, 0);
  });

  test("RLS is on with no policies (server-only table)", async () => {
    const r = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='meta_event_outbox'");
    assert.equal(r.rows[0].relrowsecurity, true);
    assert.equal(Number((await db.query<{ n: string }>("select count(*) n from pg_policies where tablename='meta_event_outbox'")).rows[0].n), 0);
  });
});
