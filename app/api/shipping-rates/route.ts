import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Public data (active shipping governorates) — no session required.
export async function GET() {
  if (!supabaseAdmin) return NextResponse.json({ governorates: [] });

  const { data } = await supabaseAdmin
    .from("shipping_rates")
    .select("governorate")
    .eq("is_active", true)
    .order("governorate", { ascending: true });

  return NextResponse.json({ governorates: (data ?? []).map((row) => row.governorate as string) });
}
