// Order Anytime policy: every active product can be ordered even at zero stock
// (it is sourced on demand), so it is advertised as available regardless of
// stock_quantity. Only inactive products are unavailable. This is deliberately
// a statement about orderability, not physical inventory. Used by the product
// structured data; the Meta catalog export SQL in docs/meta-catalog.md applies
// the same rule.
export type Availability = {
  orderable: boolean;
  // schema.org ItemAvailability URL for structured data.
  schema: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
  // Meta catalog `availability` value.
  meta: "in stock" | "out of stock";
};

export function getAvailability(isActive: boolean): Availability {
  return isActive
    ? { orderable: true, schema: "https://schema.org/InStock", meta: "in stock" }
    : { orderable: false, schema: "https://schema.org/OutOfStock", meta: "out of stock" };
}
