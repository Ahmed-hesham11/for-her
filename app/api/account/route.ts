import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ profile: null }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone_1, phone_2, governorate, address")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ profile: profile ?? null });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !supabaseAdmin) return NextResponse.json({ error: "Your session has expired. Please log in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.full_name === "string" ? body.full_name : "";
  const phone1 = typeof body?.phone_1 === "string" ? body.phone_1 : "";
  const phone2 = typeof body?.phone_2 === "string" ? body.phone_2 : "";
  const governorate = typeof body?.governorate === "string" ? body.governorate : "";
  const address = typeof body?.address === "string" ? body.address : "";

  // role is deliberately never accepted from the client here — role changes
  // only ever happen through trusted admin server code.
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      phone_1: phone1,
      phone_2: phone2 || null,
      governorate,
      address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Unable to update your profile right now." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
