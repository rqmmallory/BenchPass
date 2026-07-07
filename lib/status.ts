export const TICKET_STATUSES = [
  "queued",
  "in_progress",
  "waiting_on_parts",
  "ready",
  "picked_up",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const BOARD_STATUSES = [
  "queued",
  "in_progress",
  "waiting_on_parts",
  "ready",
] as const satisfies readonly TicketStatus[];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  queued: "Queued",
  in_progress: "In Progress",
  waiting_on_parts: "Waiting on Parts",
  ready: "Ready",
  picked_up: "Picked Up",
};

/** What the customer sees on the public status page. */
export const PUBLIC_STATUS: Record<TicketStatus, { emoji: string; label: string }> = {
  queued: { emoji: "🔧", label: "We've received your repair" },
  in_progress: { emoji: "⚙️", label: "In progress" },
  waiting_on_parts: { emoji: "📦", label: "Waiting on parts" },
  ready: { emoji: "✅", label: "Ready for pickup" },
  picked_up: { emoji: "🎸", label: "Picked up — thank you!" },
};

/** Tailwind classes for status pills, keyed by status. */
export const STATUS_STYLES: Record<TicketStatus, string> = {
  queued: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  waiting_on_parts: "bg-violet-50 text-violet-700 border-violet-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  picked_up: "bg-slate-100 text-slate-500 border-slate-200",
};

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export const INSTRUMENT_TYPES = [
  "Guitar",
  "Bass",
  "Violin",
  "Viola",
  "Cello",
  "Brass",
  "Woodwind",
  "Keyboard",
  "Other",
] as const;
