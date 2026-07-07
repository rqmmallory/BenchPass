"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/status";
import {
  dollarsToCents,
  formatDateTime,
  formatMoney,
  formatPhone,
  shortId,
} from "@/lib/format";
import { TEMPLATE_LABELS, type TemplateKey } from "@/lib/templates";
import { useToast } from "@/components/Toast";
import { CustomerSidebar } from "@/components/CustomerSidebar";

export type TicketDetailProps = {
  writable: boolean;
  publicUrl: string;
  ticket: {
    id: string;
    status: TicketStatus;
    problem: string;
    internalNotes: string | null;
    customerSummary: string | null;
    quoteCents: number | null;
    depositCents: number | null;
    partsStatus: string | null;
    intakeAt: string | null;
    readyAt: string | null;
    pickedUpAt: string | null;
  };
  customer: { id: string; name: string; phone: string | null; email: string | null };
  instrument: {
    type: string | null;
    make: string | null;
    model: string | null;
    serial: string | null;
    photoUrls: string[];
  } | null;
  messages: { id: string; channel: "sms" | "email"; body: string; sentAt: string | null }[];
  templates: Record<TemplateKey, string>;
};

async function patchTicket(
  ticketId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Save failed");
  }
}

export function TicketDetail(props: TicketDetailProps) {
  const { writable, publicUrl, customer, instrument, templates } = props;
  const router = useRouter();
  const toast = useToast();

  const [status, setStatus] = useState<TicketStatus>(props.ticket.status);
  const [problem, setProblem] = useState(props.ticket.problem);
  const [editingProblem, setEditingProblem] = useState(false);
  const [notes, setNotes] = useState(props.ticket.internalNotes ?? "");
  const [summary, setSummary] = useState(props.ticket.customerSummary ?? "");
  const [quote, setQuote] = useState(
    props.ticket.quoteCents != null ? (props.ticket.quoteCents / 100).toString() : "",
  );
  const [deposit, setDeposit] = useState(
    props.ticket.depositCents ? (props.ticket.depositCents / 100).toString() : "",
  );
  const [partsStatus, setPartsStatus] = useState(props.ticket.partsStatus ?? "");
  const [aiRunning, setAiRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  // Message panel
  const [templateKey, setTemplateKey] = useState<TemplateKey | "custom">("received");
  const [messageBody, setMessageBody] = useState(templates.received);
  const [sending, setSending] = useState<"sms" | "email" | null>(null);
  const messagePanelRef = useRef<HTMLDivElement>(null);

  const disabled = !writable;

  function saveField(update: Record<string, unknown>, okMessage?: string) {
    patchTicket(props.ticket.id, update)
      .then(() => {
        if (okMessage) toast(okMessage, "success");
        router.refresh();
      })
      .catch((err: unknown) =>
        toast(err instanceof Error ? err.message : "Save failed", "error"),
      );
  }

  async function changeStatus(next: TicketStatus) {
    const prev = status;
    setStatus(next);
    try {
      await patchTicket(props.ticket.id, { status: next });
      if (next === "ready") {
        // Nudge the pickup text — pre-fill the panel and bring it into view.
        setTemplateKey("ready");
        setMessageBody(templates.ready);
        toast("Marked ready — send the pickup text below?", "info");
        messagePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        toast(`Moved to ${STATUS_LABELS[next]}`, "success");
      }
      router.refresh();
    } catch (err) {
      setStatus(prev);
      toast(err instanceof Error ? err.message : "Could not update status", "error");
    }
  }

  async function cleanupNotes() {
    if (!notes.trim()) {
      toast("Write some bench notes first", "info");
      return;
    }
    setAiRunning(true);
    setSummary("");
    try {
      const res = await fetch("/api/ai/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: props.ticket.id, internal_notes: notes }),
      });
      if (!res.ok || !res.body) throw new Error("AI unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setSummary(accumulated);
      }
      accumulated += decoder.decode();
      setSummary(accumulated);
      await patchTicket(props.ticket.id, { customer_summary: accumulated });
      toast("Summary saved", "success");
    } catch {
      toast("AI unavailable — write a summary manually", "error");
    } finally {
      setAiRunning(false);
    }
  }

  async function sendMessage(channel: "sms" | "email") {
    if (!messageBody.trim()) return;
    setSending(channel);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: props.ticket.id,
          channel,
          body: messageBody.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Send failed");
      toast(channel === "sms" ? "Text sent" : "Email sent", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Send failed", "error");
    } finally {
      setSending(null);
    }
  }

  const instrumentName =
    instrument
      ? [instrument.make, instrument.model].filter(Boolean).join(" ") ||
        instrument.type ||
        "Instrument"
      : "Instrument";

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          #{shortId(props.ticket.id)}
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            Customer page ↗
          </a>
          <Link
            href={`/tickets/${props.ticket.id}/tag`}
            className="font-medium text-brand-600 hover:underline"
          >
            Print tag
          </Link>
        </div>
      </div>

      {/* Photos */}
      {instrument && instrument.photoUrls.length > 0 && (
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4">
          {instrument.photoUrls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setExpandedPhoto(url)}
              className="shrink-0"
              aria-label="Expand photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Instrument"
                loading="lazy"
                className="h-28 w-28 rounded-xl object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {expandedPhoto && (
        <button
          type="button"
          aria-label="Close photo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedPhoto} alt="Instrument" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}

      {/* Customer & instrument */}
      <section className="card p-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="text-left font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          {customer.name}
        </button>
        <p className="text-sm text-slate-500">
          {formatPhone(customer.phone)}
          {customer.email ? ` · ${customer.email}` : ""}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          {instrumentName}
          {instrument?.serial ? (
            <span className="text-slate-400"> · SN {instrument.serial}</span>
          ) : null}
        </p>
      </section>

      {/* Status */}
      <section className="card p-4">
        <h2 className="label">Status</h2>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Ticket status">
          {TICKET_STATUSES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={status === s}
              disabled={disabled || status === s}
              onClick={() => changeStatus(s)}
              className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                status === s
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-brand-500"
              } disabled:cursor-default`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="label mb-0">Problem</h2>
          {!editingProblem && !disabled && (
            <button
              type="button"
              className="text-xs font-medium text-brand-600"
              onClick={() => setEditingProblem(true)}
            >
              Edit
            </button>
          )}
        </div>
        {editingProblem ? (
          <textarea
            className="input mt-2 min-h-[90px]"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            onBlur={() => {
              setEditingProblem(false);
              if (problem.trim() && problem !== props.ticket.problem) {
                saveField({ problem: problem.trim() }, "Problem updated");
              }
            }}
            autoFocus
          />
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{problem}</p>
        )}
      </section>

      {/* Internal notes */}
      <section className="card p-4">
        <h2 className="label">
          Bench notes <span className="font-normal text-slate-400">(private)</span>
        </h2>
        <textarea
          className="input min-h-[110px]"
          placeholder="trc rod adj, new nut, setup 10-46…"
          value={notes}
          disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (props.ticket.internalNotes ?? "")) {
              saveField({ internal_notes: notes || null });
            }
          }}
        />
        <p className="mt-1 text-xs text-slate-400">Auto-saves. Never shown to the customer.</p>
      </section>

      {/* Customer summary */}
      <section className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="label mb-0">Customer summary</h2>
          <button
            type="button"
            disabled={disabled || aiRunning}
            onClick={() => void cleanupNotes()}
            className="btn-secondary min-h-0 px-3 py-1.5 text-xs"
          >
            {aiRunning ? "Writing…" : "Clean up my notes →"}
          </button>
        </div>
        <textarea
          className="input mt-2 min-h-[110px]"
          placeholder="What the customer sees on their status page…"
          value={summary}
          disabled={disabled}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => {
            if (summary !== (props.ticket.customerSummary ?? "") && !aiRunning) {
              saveField({ customer_summary: summary || null });
            }
          }}
        />
      </section>

      {/* Quote, deposit, parts */}
      <section className="card space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="quote">Quote</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">$</span>
              <input
                id="quote"
                className="input pl-8"
                inputMode="decimal"
                value={quote}
                disabled={disabled}
                onChange={(e) => setQuote(e.target.value)}
                onBlur={() => saveField({ quote_cents: dollarsToCents(quote) })}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="deposit">Deposit</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">$</span>
              <input
                id="deposit"
                className="input pl-8"
                inputMode="decimal"
                value={deposit}
                disabled={disabled}
                onChange={(e) => setDeposit(e.target.value)}
                onBlur={() => saveField({ deposit_cents: dollarsToCents(deposit) ?? 0 })}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="parts">Parts status</label>
          <input
            id="parts"
            className="input"
            placeholder='e.g. "ordered from StewMac, ETA Fri"'
            value={partsStatus}
            disabled={disabled}
            onChange={(e) => setPartsStatus(e.target.value)}
            onBlur={() => {
              if (partsStatus !== (props.ticket.partsStatus ?? "")) {
                saveField({ parts_status: partsStatus || null });
              }
            }}
          />
        </div>
      </section>

      {/* Send message */}
      <section ref={messagePanelRef} className="card p-4">
        <h2 className="label">Send message</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTemplateKey(key);
                setMessageBody(templates[key]);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                templateKey === key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {TEMPLATE_LABELS[key]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTemplateKey("custom");
              setMessageBody("");
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              templateKey === "custom"
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            Custom
          </button>
        </div>
        <textarea
          className="input min-h-[100px]"
          value={messageBody}
          disabled={disabled}
          onChange={(e) => setMessageBody(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={disabled || !customer.phone || sending !== null || !messageBody.trim()}
            onClick={() => void sendMessage("sms")}
            title={customer.phone ? undefined : "Customer has no phone number"}
          >
            {sending === "sms" ? "Sending…" : "Send SMS"}
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={disabled || !customer.email || sending !== null || !messageBody.trim()}
            onClick={() => void sendMessage("email")}
            title={customer.email ? undefined : "Customer has no email address"}
          >
            {sending === "email" ? "Sending…" : "Send Email"}
          </button>
        </div>

        {props.messages.length > 0 && (
          <ol className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {props.messages.map((m) => (
              <li key={m.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {m.channel === "sms" ? "SMS" : "Email"} · {formatDateTime(m.sentAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Timestamps */}
      <section className="card p-4">
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <dt className="text-xs text-slate-400">Intake</dt>
            <dd className="mt-0.5 font-medium">{formatDateTime(props.ticket.intakeAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Ready</dt>
            <dd className="mt-0.5 font-medium">{formatDateTime(props.ticket.readyAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Picked up</dt>
            <dd className="mt-0.5 font-medium">{formatDateTime(props.ticket.pickedUpAt)}</dd>
          </div>
        </dl>
      </section>

      {sidebarOpen && (
        <CustomerSidebar
          customerId={customer.id}
          currentTicketId={props.ticket.id}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
