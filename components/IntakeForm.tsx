"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dollarsToCents, formatMoney, formatPhone } from "@/lib/format";
import { INSTRUMENT_TYPES } from "@/lib/status";
import { ticketPhotoPath } from "@/lib/storage";
import { useToast } from "@/components/Toast";

type Preset = { id: string; label: string; amount_cents: number };

type CustomerMatch = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  instruments: {
    id: string;
    type: string | null;
    make: string | null;
    model: string | null;
    serial: string | null;
  }[];
};

type Photo = {
  key: string;
  previewUrl: string;
  path: string;
  state: "uploading" | "done" | "error";
};

const MAX_PHOTOS = 4;

export function IntakeForm({
  shopId,
  presets,
}: {
  shopId: string;
  presets: Preset[];
}) {
  const router = useRouter();
  const toast = useToast();

  // Client-generated so photos can upload to their final path before save.
  const [ticketId] = useState(() => crypto.randomUUID());

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [instrumentType, setInstrumentType] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [quote, setQuote] = useState("");
  const [deposit, setDeposit] = useState("");

  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced customer lookup as the tech types a phone number.
  useEffect(() => {
    if (selectedCustomer) return;
    clearTimeout(searchTimer.current);
    const q = phone.trim();
    if (q.replace(/\D/g, "").length < 3) {
      setMatches([]);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { customers: CustomerMatch[] };
        setMatches(data.customers);
        setSearchOpen(data.customers.length > 0);
      } catch {
        // Search is best-effort; typing continues to work.
      }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [phone, selectedCustomer]);

  function pickCustomer(c: CustomerMatch) {
    setSelectedCustomer(c);
    setName(c.name);
    if (c.phone) setPhone(formatPhone(c.phone) || c.phone);
    setSearchOpen(false);
    if (c.instruments.length > 0) setDetailsOpen(true);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setSelectedInstrumentId(null);
  }

  function pickInstrument(instrumentId: string) {
    const inst = selectedCustomer?.instruments.find((i) => i.id === instrumentId);
    setSelectedInstrumentId(instrumentId);
    if (inst) {
      setInstrumentType(inst.type ?? "");
      setMake(inst.make ?? "");
      setModel(inst.model ?? "");
      setSerial(inst.serial ?? "");
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const selected = Array.from(files).slice(0, room);
    if (selected.length === 0) return;

    const supabase = createClient();
    for (const file of selected) {
      const key = crypto.randomUUID();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = ticketPhotoPath(shopId, ticketId, `${key}.${ext}`);
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { key, previewUrl, path, state: "uploading" }]);

      void supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type || "image/jpeg" })
        .then(({ error }) => {
          setPhotos((prev) =>
            prev.map((p) =>
              p.key === key ? { ...p, state: error ? "error" : "done" } : p,
            ),
          );
          if (error) toast("A photo failed to upload", "error");
        });
    }
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  const canSave =
    problem.trim().length > 0 &&
    (selectedCustomer !== null || name.trim().length > 0) &&
    !saving;

  async function save() {
    if (!canSave) return;
    if (photos.some((p) => p.state === "uploading")) {
      toast("Photos are still uploading — one moment", "info");
      return;
    }
    setSaving(true);

    // Open the tab synchronously (inside the tap) so the print view isn't
    // popup-blocked; we point it at the tag once the ticket exists.
    const printTab = window.open("", "_blank");

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          customer_id: selectedCustomer?.id ?? null,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          problem: problem.trim(),
          instrument_id: selectedInstrumentId,
          instrument: {
            type: instrumentType,
            make: make.trim(),
            model: model.trim(),
            serial: serial.trim(),
          },
          photo_paths: photos.filter((p) => p.state === "done").map((p) => p.path),
          quote_cents: dollarsToCents(quote),
          deposit_cents: dollarsToCents(deposit),
        }),
      });
      const data = (await res.json()) as {
        ticket_id?: string;
        sms_sent?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ticket_id) throw new Error(data.error ?? "Save failed");

      const tagUrl = `/tickets/${data.ticket_id}/tag`;
      if (printTab) {
        printTab.location.href = tagUrl;
      } else {
        window.open(tagUrl, "_blank");
      }
      toast(
        data.sms_sent
          ? "Ticket saved — customer texted"
          : "Ticket saved",
        "success",
      );
      router.push("/");
      router.refresh();
    } catch (err) {
      printTab?.close();
      toast(err instanceof Error ? err.message : "Save failed", "error");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-4 pb-28"
    >
      {/* Photos */}
      <div className="card p-4">
        <div className="flex gap-2.5 overflow-x-auto">
          {photos.map((p) => (
            <div key={p.key} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt="Instrument photo"
                className={`h-20 w-20 rounded-xl object-cover ${p.state === "uploading" ? "opacity-60" : ""} ${p.state === "error" ? "ring-2 ring-red-400" : ""}`}
              />
              {p.state === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                  Uploading…
                </span>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => removePhoto(p.key)}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white shadow"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-500 hover:text-brand-600">
              <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-[11px] font-medium">Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Up to 4 photos — snap the damage and the whole instrument.
        </p>
      </div>

      {/* Customer */}
      <div className="card space-y-4 p-4">
        <div className="relative">
          <label htmlFor="phone" className="label">
            Customer phone <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            placeholder="(555) 123-4567"
            className="input"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (selectedCustomer) clearCustomer();
            }}
          />
          {searchOpen && (
            <ul className="absolute z-30 mt-1 w-full animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-brand-50"
                  >
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {formatPhone(c.phone)}
                        {c.instruments.length > 0 &&
                          ` · ${c.instruments.length} instrument${c.instruments.length === 1 ? "" : "s"} on file`}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-brand-600">Use</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="name" className="label">
            Customer name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            autoComplete="off"
            required={!selectedCustomer}
            placeholder="First and last name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {selectedCustomer && (
            <p className="mt-1.5 text-xs text-emerald-700">
              Returning customer — history will be linked.{" "}
              <button type="button" className="underline" onClick={clearCustomer}>
                Not them?
              </button>
            </p>
          )}
        </div>

        {selectedCustomer && selectedCustomer.instruments.length > 0 && (
          <div>
            <span className="label">Their instrument</span>
            <div className="flex flex-wrap gap-2">
              {selectedCustomer.instruments.map((inst) => {
                const label =
                  [inst.make, inst.model].filter(Boolean).join(" ") ||
                  inst.type ||
                  "Instrument";
                const active = selectedInstrumentId === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() =>
                      active ? setSelectedInstrumentId(null) : pickInstrument(inst.id)
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedInstrumentId(null)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  selectedInstrumentId === null
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                New instrument
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Problem */}
      <div className="card p-4">
        <label htmlFor="problem" className="label">
          What&apos;s wrong? <span className="text-red-500">*</span>
        </label>
        <textarea
          id="problem"
          required
          className="input min-h-[110px]"
          placeholder="Describe the problem… (tip: tap the mic on your keyboard and just say it)"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
        />
      </div>

      {/* Add details (collapsed) */}
      <div className="card p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <span className="font-semibold text-slate-700">Add details</span>
          <span
            aria-hidden
            className={`text-slate-400 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        {detailsOpen && (
          <div className="mt-4 animate-slide-up space-y-4">
            <div>
              <label htmlFor="itype" className="label">Instrument type</label>
              <select
                id="itype"
                className="input"
                value={instrumentType}
                onChange={(e) => setInstrumentType(e.target.value)}
              >
                <option value="">Select…</option>
                {INSTRUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="make" className="label">Make</label>
                <input id="make" className="input" placeholder="Fender" value={make} onChange={(e) => setMake(e.target.value)} />
              </div>
              <div>
                <label htmlFor="model" className="label">Model</label>
                <input id="model" className="input" placeholder="Stratocaster" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="serial" className="label">Serial</label>
              <input id="serial" className="input" value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>

            <div>
              <label htmlFor="quote" className="label">Quote</label>
              {presets.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setQuote((p.amount_cents / 100).toString())}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                    >
                      {p.label} · {formatMoney(p.amount_cents)}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">$</span>
                <input id="quote" className="input pl-8" inputMode="decimal" placeholder="0.00" value={quote} onChange={(e) => setQuote(e.target.value)} />
              </div>
            </div>

            <div>
              <label htmlFor="deposit" className="label">Deposit collected</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">$</span>
                <input id="deposit" className="input pl-8" inputMode="decimal" placeholder="0.00" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button type="submit" disabled={!canSave} className="btn-primary w-full">
            {saving ? "Saving…" : "Save & Print Tag"}
          </button>
        </div>
      </div>
    </form>
  );
}
