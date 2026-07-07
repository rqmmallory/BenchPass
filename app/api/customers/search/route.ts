import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Real-time customer lookup for the intake screen.
 * Matches partial phone digits or name substrings; returns each customer with
 * their instruments so intake can pre-fill instrument history.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const supabase = createClient();
  // Escape LIKE wildcards in user input so "%"/"_" search literally.
  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const digits = q.replace(/\D/g, "");

  const orFilters = [`name.ilike.%${escaped}%`];
  if (digits.length >= 3) orFilters.push(`phone.ilike.%${digits}%`);

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone, email, instruments(id, type, make, model, serial)",
    )
    .eq("shop_id", ctx.shop.id)
    .or(orFilters.join(","))
    .limit(6);

  if (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  return NextResponse.json({ customers: data ?? [] });
}
