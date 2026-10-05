-- ============================================================================
-- Switches account login/signup from email+password to phone+password.
-- profiles.phone_1 already existed (collected post-signup on the Account
-- page) but was never unique or used for authentication — email was.
--
-- This migration:
--   1. Makes profiles.email optional (drop NOT NULL) — the app no longer
--      collects it at signup. The column and its data are kept (still shown
--      on the admin Customers pages for any existing account that has one)
--      rather than dropped, since dropping is destructive and nothing here
--      requires it.
--   2. Makes profiles.phone_1 nullable too (it was NOT NULL, defaulted to
--      '' by the old email-based registration flow) — required so step 3
--      can tell "no phone on file" (NULL) apart from a literal ''.
--   3. Normalizes any existing blank phone_1 ('') to NULL before adding a
--      uniqueness constraint. Registration used to insert phone_1: '' and
--      leave it for the customer to fill in later on the Account page, so
--      more than one existing row can have phone_1 = '' — a literal '' would
--      collide under a UNIQUE constraint (Postgres treats '' as an ordinary
--      value), but multiple NULLs are allowed. Accounts with phone_1 still
--      NULL after this simply can't log in by phone until someone sets one.
--   4. Adds the UNIQUE constraint on phone_1 so it can serve as the login
--      key the same way profiles_email_key did for email.
--
-- IMPORTANT — read before running: if this ALTER TABLE ... ADD CONSTRAINT
-- still fails with a duplicate-key error after the trim/nullif cleanup
-- above, two (or more) existing profiles share the same genuine non-blank
-- phone_1. Find them with:
--   select phone_1, count(*) from public.profiles group by phone_1 having count(*) > 1;
-- then fix the duplicates in the Customers admin page (or directly in SQL)
-- before re-running just the constraint statement at the bottom.
--
-- Your own admin account (created before this migration) almost certainly
-- still has phone_1 = '' → NULL after step 2, same as any other pre-existing
-- account — meaning you will NOT be able to log in by phone until you set
-- one. Do that here in the SQL editor once this migration finishes:
--   update public.profiles set phone_1 = '<your number>' where email = 'your@email';
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

alter table public.profiles alter column email drop not null;
alter table public.profiles alter column phone_1 drop not null;

-- nullif(trim(...), '') rather than a plain `= ''` check: some existing
-- rows turned out to hold whitespace-only values (e.g. ' ' or a stray tab),
-- which a plain equality check misses, leaving two or more rows still
-- "blank" and colliding on the unique constraint below. trim() here strips
-- space/tab/newline/CR only (leading/trailing) — it never touches a real
-- phone number's digits or internal formatting.
update public.profiles set phone_1 = nullif(trim(both E' \t\n\r' from phone_1), '');

alter table public.profiles add constraint profiles_phone_1_key unique (phone_1);
