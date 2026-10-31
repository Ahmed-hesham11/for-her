import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAvailability } from "../lib/availability";

// Same rule as the export query in docs/meta-catalog.md, mirrored here so the
// stock_quantity cases are exercised against the documented SQL expression.
const sqlAvailability = (p: { is_active: boolean; stock_quantity: number }) => (p.is_active ? "in stock" : "out of stock");

describe("Order Anytime availability", () => {
  for (const stock of [12, 1, 0, -3]) {
    test(`active product with stock_quantity=${stock} is in stock and orderable`, () => {
      const a = getAvailability(true);
      assert.deepEqual([a.orderable, a.meta, a.schema], [true, "in stock", "https://schema.org/InStock"]);
      assert.equal(sqlAvailability({ is_active: true, stock_quantity: stock }), a.meta);
    });
  }
  test("inactive product is out of stock and not orderable, whatever its stock", () => {
    const a = getAvailability(false);
    assert.deepEqual([a.orderable, a.meta, a.schema], [false, "out of stock", "https://schema.org/OutOfStock"]);
    assert.equal(sqlAvailability({ is_active: false, stock_quantity: 50 }), a.meta);
  });
  test("the documented export query does not reference stock_quantity for availability", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync("docs/meta-catalog.md", "utf8");
    const caseExpr = doc.match(/case when [^\n]*as availability/)![0];
    assert.equal(caseExpr.includes("stock_quantity"), false);
    assert.match(caseExpr, /is_active/);
  });
});
