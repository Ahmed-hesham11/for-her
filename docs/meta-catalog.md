# Meta catalog — UUID as the only product id

`products.id` (the Supabase UUID) is the **catalog item ID** (`id` column) and the
`content_ids` value in the Pixel and in the Conversions API. SKU no longer exists.
Never use `orders.id` as a product id: the order id is only the Purchase `event_id`.

| Identifier | Value | Used for |
|---|---|---|
| Product | `products.id` (UUID) | catalog `id`, `content_ids`, `contents[].id` |
| Event | `event_id` (random UUID per event; **`orders.id`** for Purchase) | Pixel `eventID` = CAPI `event_id` (dedup) |
| Order | `orders.id` | Purchase `event_id` only |

Colors/sizes are options of the parent product, not separate items, so there is one
catalog row per product and no `item_group_id`.

## CSV columns (upload via Commerce Manager > Catalog > Items > Data sources > Upload)

`id,title,description,availability,condition,price,link,image_link,brand`

- `id` — `products.id`, exactly as stored (lowercase UUID).
- `availability` — `in stock` (active) or `out of stock` (inactive); see below.
- `price` — `250.00 EGP`.
- `link` — `https://<site>/product/<id>`; `image_link` — absolute image URL.

## Export query (Supabase SQL editor, read-only)

Replace `https://YOUR-SITE` (use the production origin from `NEXT_PUBLIC_SITE_URL`).
Prefix relative image paths with the same origin if any exist.

```sql
select
  p.id                                   as id,
  p.name                                 as title,
  coalesce(nullif(p.description, ''), p.name) as description,
  case when p.is_active then 'in stock' else 'out of stock' end as availability,
  'new'                                  as condition,
  to_char(p.selling_price, 'FM999999990.00') || ' EGP' as price,
  'https://YOUR-SITE/product/' || p.id   as link,
  case when p.image_url ~* '^https?://' then p.image_url else 'https://YOUR-SITE' || p.image_url end as image_link,
  'FOR HER'                              as brand
from public.products p
order by p.created_at;
```

Download the result as CSV and upload it to the **existing** catalog data source
("Replace" the items so the ids are updated). Items whose old id was a SKU will stay
under the old id until removed; delete them after the new upload so they are not
duplicated.

## Availability (Order Anytime policy)

FOR HER sources products on demand, so every active product is orderable even at zero
stock and is exported as `in stock` regardless of `stock_quantity`. This describes
orderability, not physical inventory.

| Condition | Meta `availability` | schema.org | Orderable |
|---|---|---|---|
| active (any `stock_quantity`, including 0) | `in stock` | InStock | yes |
| inactive / disabled | `out of stock` | OutOfStock | no |

The export query keeps inactive products in the file (no `where p.is_active` filter) so
they are flagged `out of stock` rather than left as stale items. If you would rather
omit them, add `where p.is_active`.

The same rule lives in `lib/availability.ts` (used by the product-page structured data)
and in the query above. Checkout and inventory logic are unchanged. Re-export and
re-upload when a product is activated or deactivated, since the catalog is a manual upload.

## After upload — verify (not yet done)

1. Commerce Manager > Catalog > Items: ids are UUIDs, status not "Ineligible".
2. Events Manager > Data sources > pixel > Diagnostics: "content IDs match catalog"
   for ViewContent / AddToCart / Purchase.
3. Events Manager > Test events (use `META_CAPI_TEST_EVENT_CODE` for the server side):
   each event appears twice (Browser + Server) and is marked **Deduplicated**.
