"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, formatMoney, formatPhone, shortId } from "@/lib/format";
import { isTicketStatus } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";

type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  instruments: {
    id: string;
    type: string | null;
    make: string | null;
    model: string | null;
    serial: string | null;
  }[];
  tickets: {
    id: string;
    status: string;
    problem: string;
    quote_cents: number | null;
    intake_at: string | null;
  }[];
};

/** Slide-over showing a customer's instruments and full repair history. */
export function CustomerSidebar({
  customerId,
  currentTicketId,
  onClose,
}: {
  customerId: string;
  currentTicketId: string;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customers/${customerId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { customer: CustomerDetail };
        if (!cancelled) setCustomer(data.customer);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close customer details"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-sm animate-slide-up flex-col overflow-y-auto bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        >
          ✕
        </button>

        {failed && (
          <p className="mt-10 text-sm text-red-600">Could not load customer details.</p>
        )}

        {!customer && !failed && (
          <div className="mt-10 space-y-3">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-24 w-full" />
          </div>
        )}

        {customer && (
          <>
            <h2 className="pr-10 text-lg font-bold">{customer.name}</h2>
            <p className="text-sm text-slate-500">
              {formatPhone(customer.phone)}
              {customer.email ? ` · ${customer.email}` : ""}
            </p>

            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-500">
              Instruments
            </h3>
            {customer.instruments.length === 0 ? (
              <p className="text-sm text-slate-400">No instruments on file.</p>
            ) : (
              <ul className="space-y-1.5">
                {customer.instruments.map((inst) => (
                  <li key={inst.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium">
                      {[inst.make, inst.model].filter(Boolean).join(" ") ||
                        inst.type ||
                        "Instrument"}
                    </span>
                    {inst.serial && (
                      <span className="text-slate-400"> · SN {inst.serial}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-500">
              Repair history
            </h3>
            {customer.tickets.length === 0 ? (
              <p className="text-sm text-slate-400">No past repairs.</p>
            ) : (
              <ul className="space-y-2">
                {customer.tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tickets/${t.id}`}
                      onClick={t.id === currentTicketId ? onClose : undefined}
                      className={`block rounded-xl border p-3 text-sm transition hover:border-brand-500 ${
                        t.id === currentTicketId
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">#{shortId(t.id)}</span>
                        {isTicketStatus(t.status) && <StatusBadge status={t.status} />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-slate-600">{t.problem}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(t.intake_at)}
                        {t.quote_cents != null && ` · ${formatMoney(t.quote_cents)}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
