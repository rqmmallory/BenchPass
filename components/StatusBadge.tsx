import { STATUS_LABELS, STATUS_STYLES, type TicketStatus } from "@/lib/status";

export function StatusBadge({
  status,
  className = "",
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
