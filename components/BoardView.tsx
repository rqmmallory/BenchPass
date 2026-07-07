"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BOARD_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/status";
import { daysSince, shortId } from "@/lib/format";
import { useToast } from "@/components/Toast";

export type BoardTicket = {
  id: string;
  status: TicketStatus;
  intakeAt: string | null;
  readyAt: string | null;
  updatedAt: string;
  customerName: string;
  instrumentType: string | null;
  photoUrl: string | null;
};

const INSTRUMENT_ICONS: Record<string, string> = {
  Guitar: "🎸",
  Bass: "🎸",
  Violin: "🎻",
  Viola: "🎻",
  Cello: "🎻",
  Brass: "🎺",
  Woodwind: "🎷",
  Keyboard: "🎹",
};

function instrumentIcon(type: string | null): string {
  return (type && INSTRUMENT_ICONS[type]) || "🎵";
}

/** Amber: sitting in Ready > 5 days. Red: untouched > 14 days (call them!). */
function urgencyClass(t: BoardTicket): string {
  if (daysSince(t.updatedAt) > 14) return "border-red-400 ring-1 ring-red-200";
  if (t.status === "ready" && daysSince(t.readyAt) > 5)
    return "border-amber-400 ring-1 ring-amber-200";
  return "border-slate-200";
}

export function BoardView({
  tickets,
  writable,
}: {
  tickets: BoardTicket[];
  writable: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TicketStatus>("queued");

  const byStatus = (status: TicketStatus) =>
    tickets.filter((t) => t.status === status);

  return (
    <>
      {/* Mobile: status tabs */}
      <div
        role="tablist"
        aria-label="Ticket status"
        className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1 md:hidden"
      >
        {BOARD_STATUSES.map((status) => {
          const count = byStatus(status).length;
          const active = activeTab === status;
          return (
            <button
              key={status}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(status)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {STATUS_LABELS[status]}
              <span
                className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-slate-100"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="md:hidden">
        <Column
          status={activeTab}
          tickets={byStatus(activeTab)}
          writable={writable}
          showHeading={false}
        />
      </div>

      {/* Desktop: four columns */}
      <div className="hidden gap-4 md:grid md:grid-cols-4">
        {BOARD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={byStatus(status)}
            writable={writable}
            showHeading
          />
        ))}
      </div>

      {/* FAB → New intake */}
      <Link
        href="/intake"
        aria-label="New intake"
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-fab transition active:scale-95 hover:bg-brand-700"
      >
        <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </>
  );
}

const EMPTY_COPY: Record<TicketStatus, string> = {
  queued: "Nothing waiting. Tap + to check in a repair.",
  in_progress: "Nothing on the bench right now.",
  waiting_on_parts: "No repairs waiting on parts.",
  ready: "Nothing ready for pickup.",
  picked_up: "No history yet.",
};

function Column({
  status,
  tickets,
  writable,
  showHeading,
}: {
  status: TicketStatus;
  tickets: BoardTicket[];
  writable: boolean;
  showHeading: boolean;
}) {
  return (
    <section aria-label={STATUS_LABELS[status]}>
      {showHeading && (
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
          {STATUS_LABELS[status]}
          <span className="rounded-full bg-slate-200 px-1.5 text-xs text-slate-600">
            {tickets.length}
          </span>
        </h2>
      )}
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          {EMPTY_COPY[status]}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tickets.map((t) => (
            <li key={t.id}>
              <TicketCard ticket={t} writable={writable} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TicketCard({
  ticket,
  writable,
}: {
  ticket: BoardTicket;
  writable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const days = daysSince(ticket.intakeAt);

  async function confirmStatusChange(next: TicketStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not update status");
      }
      toast(`Moved to ${STATUS_LABELS[next]}`, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update status", "error");
    } finally {
      setSaving(false);
      setMenuOpen(false);
      setPendingStatus(null);
    }
  }

  return (
    <div
      className={`card relative flex items-stretch gap-3 border p-3 transition ${urgencyClass(ticket)}`}
    >
      <Link
        href={`/tickets/${ticket.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {ticket.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ticket.photoUrl}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl"
          >
            {instrumentIcon(ticket.instrumentType)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">
            {ticket.customerName}
          </p>
          <p className="truncate text-sm text-slate-500">
            {ticket.instrumentType ?? "Instrument"} · #{shortId(ticket.id)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {days === 0 ? "In today" : `${days} day${days === 1 ? "" : "s"} in shop`}
          </p>
        </div>
      </Link>

      <div className="flex flex-col items-end justify-between">
        <button
          type="button"
          disabled={!writable}
          onClick={() => {
            setMenuOpen((v) => !v);
            setPendingStatus(null);
          }}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold disabled:opacity-60 ${STATUS_STYLES[ticket.status]}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {STATUS_LABELS[ticket.status]}
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-2 top-10 z-30 w-48 animate-slide-up rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {TICKET_STATUSES.filter((s) => s !== ticket.status).map((s) => (
            <button
              key={s}
              role="menuitem"
              disabled={saving}
              onClick={() =>
                pendingStatus === s ? confirmStatusChange(s) : setPendingStatus(s)
              }
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                pendingStatus === s
                  ? "bg-brand-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {pendingStatus === s
                ? saving
                  ? "Moving…"
                  : `Tap to confirm → ${STATUS_LABELS[s]}`
                : STATUS_LABELS[s]}
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPendingStatus(null);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
