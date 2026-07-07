import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable } from "@/lib/plan";
import { isTicketStatus, type TicketStatus } from "@/lib/status";
import { photoUrl } from "@/lib/storage";
import { BoardView, type BoardTicket } from "@/components/BoardView";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const { shop } = await requireShop();
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("tickets")
    .select(
      "id, status, intake_at, ready_at, updated_at, customers(name), instruments(type, make, model, photo_urls)",
    )
    .eq("shop_id", shop.id)
    .neq("status", "picked_up")
    .order("intake_at", { ascending: true });

  const tickets: BoardTicket[] = (rows ?? []).flatMap((row) => {
    if (!isTicketStatus(row.status)) return [];
    const firstPhoto = row.instruments?.photo_urls?.[0];
    const ticket: BoardTicket = {
      id: row.id,
      status: row.status satisfies TicketStatus,
      intakeAt: row.intake_at,
      readyAt: row.ready_at,
      updatedAt: row.updated_at,
      customerName: row.customers?.name ?? "Unknown customer",
      instrumentType: row.instruments?.type ?? null,
      photoUrl: firstPhoto ? photoUrl(firstPhoto) : null,
    };
    return [ticket];
  });

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Board</h1>
        <Link
          href="/history"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          View history
        </Link>
      </div>
      <BoardView tickets={tickets} writable={shopIsWritable(shop)} />
    </div>
  );
}
