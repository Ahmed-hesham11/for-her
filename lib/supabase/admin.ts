import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

// Service-role client — bypasses RLS entirely. Server-only: this file must
// never be imported from a "use client" module, and SUPABASE_SERVICE_ROLE_KEY
// must never be prefixed NEXT_PUBLIC_. Since there is no Supabase Auth JWT
// anymore, this is the only client used to read/write profiles, sessions,
// carts, cart_items, wishlists, orders, and order_items — ownership checks
// (WHERE user_id = ...) happen in this trusted server code instead of in
// Postgres RLS.
export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
