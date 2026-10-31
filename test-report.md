# Meta Pixel / Conversions API — automated test report

Generated: 2026-10-30T21:48:08.338Z

**75 passed, 0 failed, 0 skipped, 75 total.**

> Everything below ran locally against mocked Supabase (HTTP-level fake of PostgREST) and a mocked Meta Graph API, plus an in-process Postgres (PGlite) for the migration SQL. **No event was sent to Meta, so nothing here shows that Meta received, accepted or deduplicated any event.**

## Requirements

| # | Requirement | Expected result | Actual result | Pass/fail |
|---|---|---|---|---|
| 1 | Pixel initialization happens only once | One fbq('init') for the pixel id, fbevents.js inserted once, no PageView inside the snippet, skipped on /admin, script mounted once in the layout, noscript fallback present. | 4/4 checks passed: the base snippet queues exactly one init and loads fbevents.js once; the snippet is skipped on /admin; the layout mounts the script and tracker exactly once and no other file initializes the pixel; the noscript fallback is present | **PASS** |
| 2 | PageView fires once on load and on navigation | Exactly one PageView per distinct route (initial load, each client-side navigation); none on re-render of the same route; none on /admin. | 1/1 checks passed: one PageView per distinct route, none on re-render, none on /admin | **PASS** |
| 3 | ViewContent sends the product SKU | content_ids = [sku] (never the UUID), name, numeric value, currency EGP; fires once per product id. | 2/2 checks passed: sends the SKU (not the product UUID) with name, value and EGP; the product page passes product.sku, and ViewContent runs once per product id | **PASS** |
| 4 | AddToCart sends SKU, quantity and value | content_ids = [sku], num_items = quantity, value = price × quantity; fired only after the server accepted the add. | 2/2 checks passed: sends SKU, quantity and value = price × quantity; the cart fires it only after the server accepted the add (not on failure paths) | **PASS** |
| 5 | InitiateCheckout sends cart SKUs and total | content_ids = every cart SKU, num_items = total quantity, value = sum of price × quantity; once per checkout visit. | 2/2 checks passed: sends every cart SKU, total quantity and the summed value; the checkout page fires it once per visit, guarded by a ref | **PASS** |
| 6 | Purchase only after successful order creation | Browser call sits after the failed-response throw; a rolled-back/failed order leaves no outbox row so nothing is sent. | 3/3 checks passed: the browser call sits after the failed-response throw and is the only call site; a failed (rolled-back) order leaves no outbox row, so the worker sends nothing; a failed order response produces no browser Purchase | **PASS** |
| 7 | Browser and server Purchase share the event_id | Same event_name and the order id as event_id on both, stable across retries. | 2/2 checks passed: same event_name and event_id (the order id); the event_id is stable across retries | **PASS** |
| 8 | Purchase uses saved order_items | content_ids / num_items / value come from the database rows read by order id, not from the request. | 3/3 checks passed: content_ids, num_items and value come from the database rows; later changes to the DB rows (not to any client data) change the payload; the order route no longer reads items, prices or totals from the request for Meta | **PASS** |
| 9 | Missing SKUs never fall back to UUIDs | Items without a SKU are excluded; the product UUID never appears in any payload; the event still carries value. | 3/3 checks passed: items with null or blank SKU are excluded; the product UUID never appears in the payload; an order with no SKUs still reports value but omits content_ids entirely; browser events with an empty SKU are dropped | **PASS** |
| 10 | Invalid prices and totals are rejected | NaN / negative / infinite prices and totals send nothing (browser) or fail permanently without a Meta request (server). | 3/3 checks passed: browser: NaN / negative prices and totals send nothing; server: a negative or non-numeric order total is failed permanently, never sent; server: an item with an invalid unit_price is excluded from content_ids | **PASS** |
| 11 | Duplicate Purchase attempts are prevented | One outbox row per order; concurrent workers produce one Meta request; a sent event is never re-sent. | 3/3 checks passed: the outbox allows one row per order; two workers racing for one order produce exactly one Meta request; a sent event is never sent again, by the fast path or the cron | **PASS** |
| 12 | Failed Meta requests remain retryable | 500/429/timeout/network leave the event pending with a future retry time; later run succeeds with original event_time; permanent 4xx is failed. | 3/3 checks passed: 500, 429, timeout and network errors all leave the event pending with a future retry time; it is delivered on a later run, with attempts counted and the original event_time; a permanent Meta error (400, code 100) is failed, not retried | **PASS** |
| 13 | Outbox recovers abandoned jobs | A claimed-then-abandoned event is re-claimed after its lease expires; a stale worker cannot overwrite the result. | 3/3 checks passed: a worker that dies after claiming is recovered once its lease expires; a worker whose lease was taken over cannot overwrite the new result; a stale worker cannot mark an event sent/failed while another worker holds a newer lease | **PASS** |
| 14 | Successful responses mark events as sent | Lifecycle pending → processing → sent (and via retry); sent_at set only after Meta accepts; unconfigured token leaves events untouched. | 3/3 checks passed: states are observed in order and sent_at is recorded only after Meta accepts; pending → processing → pending (retry) → processing → sent; an unconfigured token leaves events pending without consuming an attempt | **PASS** |
| 15 | Access token never reaches the browser | Token only in the server request body; not in URLs, logs, the outbox table, client components or the built client bundle. | 4/4 checks passed: the token is sent in the request body, never the URL, and never logged; no client component imports server-only Meta/Supabase-admin modules or reads the token; no NEXT_PUBLIC_ variable carries a secret, and only API routes/lib import the CAPI modules; the built client bundle contains neither the real token nor the variable name (skipped if no build exists) | **PASS** |
| 16 | Checkout does not wait for Meta | With Meta held open the post-order step returns immediately; the event is delivered when Meta answers. | 2/2 checks passed: with Meta held open, the post-order step still returns immediately; the event is sent when Meta answers; the order route uses after() and does not await delivery | **PASS** |

## Every test

| Test | Result | Time (ms) |
|---|---|---|
| existing orders are preserved and not backfilled | PASS | 7.4 |
| a successful order creates exactly one outbox record: event_id = order id, event_time = created_at | PASS | 13.7 |
| a failed (rolled-back) order creates no outbox record | PASS | 6.7 |
| manual orders without a user are not enqueued | PASS | 4.2 |
| duplicates are impossible: unique(order_id, event_name) | PASS | 10.3 |
| claim leases each event once; a second worker gets nothing | PASS | 9.8 |
| a crashed worker's expired lease is reclaimed with a new token | PASS | 8.6 |
| scheduled retries wait for next_attempt_at, sent/failed are never claimed, p_order_id filters | PASS | 11.2 |
| RLS is on with no policies (server-only table) | PASS | 5.4 |
| successful Meta delivery marks the event sent; it is not sent twice | PASS | 4.1 |
| failed delivery stays retryable with backoff, then succeeds | PASS | 1.8 |
| Meta timeout does not lose the event | PASS | 2.3 |
| a permanent API error is failed, not retried forever | PASS | 1.0 |
| retries stop after MAX_ATTEMPTS | PASS | 0.6 |
| events past Meta's 7-day limit are failed without sending | PASS | 0.5 |
| an unexpected exception keeps the event retryable | PASS | 1.6 |
| two workers cannot process the same event | PASS | 17.2 |
| two workers racing for one event: exactly one gets it | PASS | 0.5 |
| a crash after claiming is recovered once the lease expires | PASS | 0.4 |
| a stale worker cannot overwrite the result after its lease was taken over | PASS | 0.4 |
| replaying an order uses the same event_id and the saved order_items | PASS | 2.0 |
| event_time is orders.created_at and unchanged across retries | PASS | 0.8 |
| missing SKU never falls back to the UUID | PASS | 0.4 |
| value comes from the saved order total | PASS | 1.1 |
| browser and server Purchase share the same event_name and event_id | PASS | 1.2 |
| the order response does not wait for the Meta API | PASS | 0.7 |
| a context-save or delivery failure never throws into checkout | PASS | 0.4 |
| the access token is sent in the body, never in the URL, and never logged | PASS | 63.5 |
| error classification: 5xx / 429 / transient code retryable, other 4xx permanent | PASS | 4.0 |
| when not configured, no request is made | PASS | 0.4 |
| user_data is hashed once and raw PII is absent | PASS | 0.6 |
| the cron endpoint auth fails closed | PASS | 0.4 |
| [R1] the base snippet queues exactly one init and loads fbevents.js once | PASS | 3.6 |
| [R1] the snippet is skipped on /admin | PASS | 4.1 |
| [R1] the layout mounts the script and tracker exactly once and no other file initializes the pixel | PASS | 213.8 |
| [R1] the noscript fallback is present | PASS | 1.5 |
| [R2] one PageView per distinct route, none on re-render, none on /admin | PASS | 40.3 |
| [R3] sends the SKU (not the product UUID) with name, value and EGP | PASS | 1.0 |
| [R3] the product page passes product.sku, and ViewContent runs once per product id | PASS | 1.8 |
| [R4] sends SKU, quantity and value = price × quantity | PASS | 1.0 |
| [R4] the cart fires it only after the server accepted the add (not on failure paths) | PASS | 1.5 |
| [R5] sends every cart SKU, total quantity and the summed value | PASS | 1.2 |
| [R5] the checkout page fires it once per visit, guarded by a ref | PASS | 2.2 |
| [R6] the browser call sits after the failed-response throw and is the only call site | PASS | 1.9 |
| [R6] a failed (rolled-back) order leaves no outbox row, so the worker sends nothing | PASS | 8.1 |
| [R6] a failed order response produces no browser Purchase | PASS | 1.6 |
| [R7] same event_name and event_id (the order id) | PASS | 11.1 |
| [R7] the event_id is stable across retries | PASS | 5.5 |
| [R8] content_ids, num_items and value come from the database rows | PASS | 6.0 |
| [R8] later changes to the DB rows (not to any client data) change the payload | PASS | 4.1 |
| [R8] the order route no longer reads items, prices or totals from the request for Meta | PASS | 0.7 |
| [R9] items with null or blank SKU are excluded; the product UUID never appears in the payload | PASS | 2.8 |
| [R9] an order with no SKUs still reports value but omits content_ids entirely | PASS | 1.8 |
| [R9] browser events with an empty SKU are dropped | PASS | 0.6 |
| [R10] browser: NaN / negative prices and totals send nothing | PASS | 0.5 |
| [R10] server: a negative or non-numeric order total is failed permanently, never sent | PASS | 5.6 |
| [R10] server: an item with an invalid unit_price is excluded from content_ids | PASS | 3.9 |
| [R11] the outbox allows one row per order | PASS | 0.3 |
| [R11] two workers racing for one order produce exactly one Meta request | PASS | 2.3 |
| [R11] a sent event is never sent again, by the fast path or the cron | PASS | 3.9 |
| [R12] 500, 429, timeout and network errors all leave the event pending with a future retry time | PASS | 14.3 |
| [R12] it is delivered on a later run, with attempts counted and the original event_time | PASS | 6.8 |
| [R12] a permanent Meta error (400, code 100) is failed, not retried | PASS | 9.7 |
| [R13] a worker that dies after claiming is recovered once its lease expires | PASS | 4.3 |
| [R13] a worker whose lease was taken over cannot overwrite the new result | PASS | 4.6 |
| [R13] a stale worker cannot mark an event sent/failed while another worker holds a newer lease | PASS | 63.9 |
| [R14] states are observed in order and sent_at is recorded only after Meta accepts | PASS | 5.8 |
| [R14] pending → processing → pending (retry) → processing → sent | PASS | 5.2 |
| [R14] an unconfigured token leaves events pending without consuming an attempt | PASS | 0.8 |
| [R15] the token is sent in the request body, never the URL, and never logged | PASS | 6.7 |
| [R15] no client component imports server-only Meta/Supabase-admin modules or reads the token | PASS | 191.5 |
| [R15] no NEXT_PUBLIC_ variable carries a secret, and only API routes/lib import the CAPI modules | PASS | 364.5 |
| [R15] the built client bundle contains neither the real token nor the variable name (skipped if no build exists) | PASS | 193.0 |
| [R16] with Meta held open, the post-order step still returns immediately; the event is sent when Meta answers | PASS | 60.7 |
| [R16] the order route uses after() and does not await delivery | PASS | 1.2 |

## Limitations (not covered by these tests)

- No real Supabase: the trigger/claim SQL runs in PGlite (single connection), so true parallel row locking (`FOR UPDATE SKIP LOCKED`) is untested; concurrency tests prove the claim logic and the conditional updates only.
- The Next.js route handler itself (`POST /api/orders`) is not executed (it needs a session cookie and the real RPC); its wiring is checked by source-contract tests and by running the exact helpers it calls.
- `ViewContent` and `AddToCart` call sites are verified by source contracts plus the tracking helpers; the full product page / cart UI is not rendered in a browser.
- Real browser behaviour (ad blockers, `fbevents.js` loading, Pixel Helper) and everything on Meta's side (receipt, deduplication, Event Match Quality, catalog matching) require manual checks: see the DevTools instructions.
- Hostinger specifics (cron availability, `after()` support) are not verifiable locally.
