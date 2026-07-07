import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Customer detail for the ticket-page sidebar: instruments + repair history. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone, email, notes, instruments(id, type, make, model, serial), tickets(id, status, problem, quote_cents, intake_at)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    customer: {
      ...customer,
      tickets: [...customer.tickets].sort((a, b) =>
        (b.intake_at ?? "").localeCompare(a.intake_at ?? ""),
      ),
    },
  });
}
