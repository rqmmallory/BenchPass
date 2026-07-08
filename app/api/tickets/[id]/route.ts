import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable } from "@/lib/plan";
import { isTicketStatus } from "@/lib/status";
import type { TablesUpdate } from "@/types/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PatchBody = {
  status?: unknown;
  internal_notes?: unknown;
  customer_summary?: unknown;
  problem?: unknown;
  quote_cents?: unknown;
  deposit_cents?: unknown;
  parts_status?: unknown;
};

function optionalText(value: unknown, maxLen: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.slice(0, maxLen);
}

function optionalCents(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000_00)
    return value;
  return undefined;
}

/** Partial update of a ticket. RLS guarantees the ticket belongs to the caller's shop. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }
  if (!shopIsWritable(ctx.shop)) {
    return NextResponse.json(
      { error: "Your subscription is inactive — reactivate in Settings → Billing" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const update: TablesUpdate<"tickets"> = {};

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isTicketStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "ready") update.ready_at = new Date().toISOString();
    if (body.status === "picked_up") update.picked_up_at = new Date().toISOString();
    // Moving backward clears stale milestones so board age nudges stay honest.
    if (body.status !== "picked_up") update.picked_up_at = null;
    if (body.status !== "ready" && body.status !== "picked_up") update.ready_at = null;
  }

  const problem = optionalText(body.problem, 4000);
  if (typeof problem === "string" && problem.trim()) update.problem = problem;

  const internalNotes = optionalText(body.internal_notes, 8000);
  if (internalNotes !== undefined) update.internal_notes = internalNotes;

  const customerSummary = optionalText(body.customer_summary, 4000);
  if (customerSummary !== undefined) update.customer_summary = customerSummary;

  const partsStatus = optionalText(body.parts_status, 500);
  if (partsStatus !== undefined) update.parts_status = partsStatus;

  const quote = optionalCents(body.quote_cents);
  if (quote !== undefined) update.quote_cents = quote;

  const deposit = optionalCents(body.deposit_cents);
  if (deposit !== undefined) update.deposit_cents = deposit;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update(update)
    .eq("id", params.id)
    .select("id, status, ready_at, picked_up_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket: data });
}
