// node:test reporter that writes the Meta integration test report (markdown).
// Usage: npm run test:report  → test-report.md
// Only reports what actually ran in this process; nothing here says Meta received anything.

const REQUIREMENTS = {
  1: ["Pixel initialization happens only once", "One fbq('init') for the pixel id, fbevents.js inserted once, no PageView inside the snippet, skipped on /admin, script mounted once in the layout, noscript fallback present."],
  2: ["PageView fires once on load and on navigation", "Exactly one PageView per distinct route (initial load, each client-side navigation); none on re-render of the same route; none on /admin."],
  3: ["ViewContent sends the product UUID", "content_ids = [product UUID], name, numeric value, currency EGP; fires once per product id."],
  4: ["AddToCart sends product UUID, quantity and value", "content_ids = [product UUID], num_items = quantity, value = price × quantity; fired only after the server accepted the add."],
  5: ["InitiateCheckout sends cart product UUIDs and total", "content_ids = every cart product UUID, num_items = total quantity, value = sum of price × quantity; once per checkout visit."],
  6: ["Purchase only after successful order creation", "Browser call sits after the failed-response throw; a rolled-back/failed order leaves no outbox row so nothing is sent."],
  7: ["Browser and server Purchase share the event_id", "Same event_name and the order id as event_id on both, stable across retries."],
  8: ["Purchase uses saved order_items", "content_ids / num_items / value come from the database rows read by order id, not from the request."],
  9: ["Non-UUID ids are never sent", "Items without a valid product UUID are excluded (no SKU or order id is ever substituted); the event still carries value."],
  10: ["Invalid prices and totals are rejected", "NaN / negative / infinite prices and totals send nothing (browser) or fail permanently without a Meta request (server)."],
  11: ["Duplicate Purchase attempts are prevented", "One outbox row per order; concurrent workers produce one Meta request; a sent event is never re-sent."],
  12: ["Failed Meta requests remain retryable", "500/429/timeout/network leave the event pending with a future retry time; later run succeeds with original event_time; permanent 4xx is failed."],
  13: ["Outbox recovers abandoned jobs", "A claimed-then-abandoned event is re-claimed after its lease expires; a stale worker cannot overwrite the result."],
  14: ["Successful responses mark events as sent", "Lifecycle pending → processing → sent (and via retry); sent_at set only after Meta accepts; unconfigured token leaves events untouched."],
  15: ["Access token never reaches the browser", "Token only in the server request body; not in URLs, logs, the outbox table, client components or the built client bundle."],
  16: ["Checkout does not wait for Meta", "With Meta held open the post-order step returns immediately; the event is delivered when Meta answers."],
};

const tag = (name) => name.match(/^\[R(\d+)\]/)?.[1];
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export default async function* reporter(source) {
  const leaf = [];
  let counts = { tests: 0, pass: 0, fail: 0, skipped: 0 };
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    if (event.data.details?.type === "suite") continue;
    const failed = event.type === "test:fail";
    const skipped = event.data.skip !== undefined && event.data.skip !== false;
    leaf.push({ name: event.data.name, failed, skipped, ms: event.data.details?.duration_ms ?? 0, error: failed ? (event.data.details?.error?.cause?.message ?? event.data.details?.error?.message ?? "failed") : "" });
    counts.tests++; if (failed) counts.fail++; else if (skipped) counts.skipped++; else counts.pass++;
  }

  const out = [];
  out.push("# Meta Pixel / Conversions API — automated test report", "");
  out.push(`Generated: ${new Date().toISOString()}`, "");
  out.push(`**${counts.pass} passed, ${counts.fail} failed, ${counts.skipped} skipped, ${counts.tests} total.**`, "");
  out.push("> Everything below ran locally against mocked Supabase (HTTP-level fake of PostgREST) and a mocked Meta Graph API, plus an in-process Postgres (PGlite) for the migration SQL. **No event was sent to Meta, so nothing here shows that Meta received, accepted or deduplicated any event.**", "");

  out.push("## Requirements", "", "| # | Requirement | Expected result | Actual result | Pass/fail |", "|---|---|---|---|---|");
  for (const [n, [title, expected]] of Object.entries(REQUIREMENTS)) {
    const tests = leaf.filter((t) => tag(t.name) === n);
    const failedTests = tests.filter((t) => t.failed);
    const skipped = tests.filter((t) => t.skipped);
    let actual; let verdict;
    if (tests.length === 0) { actual = "No test found for this requirement."; verdict = "NOT TESTED"; }
    else if (failedTests.length) { actual = failedTests.map((t) => `FAILED: ${t.name.replace(/^\[R\d+\]\s*/, "")} — ${t.error}`).join(" ; "); verdict = "FAIL"; }
    else { actual = `${tests.length - skipped.length}/${tests.length} checks passed: ` + tests.map((t) => `${t.skipped ? "(skipped) " : ""}${t.name.replace(/^\[R\d+\]\s*/, "")}`).join("; "); verdict = skipped.length ? "PASS (with skips)" : "PASS"; }
    out.push(`| ${n} | ${esc(title)} | ${esc(expected)} | ${esc(actual)} | **${verdict}** |`);
  }

  out.push("", "## Every test", "", "| Test | Result | Time (ms) |", "|---|---|---|");
  for (const t of leaf) out.push(`| ${esc(t.name)} | ${t.failed ? `FAIL — ${esc(t.error)}` : t.skipped ? "SKIP" : "PASS"} | ${t.ms.toFixed(1)} |`);

  out.push("", "## Limitations (not covered by these tests)", "",
    "- No real Supabase: the trigger/claim SQL runs in PGlite (single connection), so true parallel row locking (`FOR UPDATE SKIP LOCKED`) is untested; concurrency tests prove the claim logic and the conditional updates only.",
    "- The Next.js route handler itself (`POST /api/orders`) is not executed (it needs a session cookie and the real RPC); its wiring is checked by source-contract tests and by running the exact helpers it calls.",
    "- `ViewContent` and `AddToCart` call sites are verified by source contracts plus the tracking helpers; the full product page / cart UI is not rendered in a browser.",
    "- Real browser behaviour (ad blockers, `fbevents.js` loading, Pixel Helper) and everything on Meta's side (receipt, deduplication, Event Match Quality, catalog matching) require manual checks: see the DevTools instructions.",
    "- Hostinger specifics (cron availability, `after()` support) are not verifiable locally.");
  yield out.join("\n") + "\n";
}
