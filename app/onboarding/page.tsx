"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dollarsToCents } from "@/lib/format";
import { logoPath } from "@/lib/storage";
import { useToast } from "@/components/Toast";

const DEFAULT_RECEIVED_TEMPLATE =
  "Hi {customer_name}, we've received your {instrument} at {shop_name}. We'll be in touch with a quote shortly.";

const STEPS = ["Shop name", "Logo", "Phone", "Price preset", "First message"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [shopName, setShopName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [presetLabel, setPresetLabel] = useState("Full setup");
  const [presetAmount, setPresetAmount] = useState("95");
  const [receivedTemplate, setReceivedTemplate] = useState(DEFAULT_RECEIVED_TEMPLATE);

  const canAdvance = step !== 0 || shopName.trim().length > 0;

  function handleLogoChange(file: File | null) {
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_name: shopName.trim(),
          phone: phone.trim() || null,
          preset:
            presetLabel.trim() && dollarsToCents(presetAmount)
              ? {
                  label: presetLabel.trim(),
                  amount_cents: dollarsToCents(presetAmount),
                }
              : null,
          received_template: receivedTemplate.trim(),
        }),
      });
      const data = (await res.json()) as { shop_id?: string; error?: string };
      if (!res.ok || !data.shop_id) {
        throw new Error(data.error ?? "Something went wrong");
      }

      if (logoFile) {
        const supabase = createClient();
        const ext = logoFile.name.split(".").pop() ?? "png";
        const path = logoPath(data.shop_id, `logo-${Date.now()}.${ext}`);
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          await supabase.from("shops").update({ logo_url: path }).eq("id", data.shop_id);
        }
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not finish setup", "error");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-600">
          Step {step + 1} of {STEPS.length}
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="card animate-slide-up flex-1 p-6">
        {step === 0 && (
          <>
            <h1 className="text-xl font-bold">What&apos;s your shop called?</h1>
            <p className="mt-1 text-sm text-slate-500">
              This appears on customer texts and your public status page.
            </p>
            <input
              autoFocus
              className="input mt-5"
              placeholder="Riverside Guitar Works"
              value={shopName}
              maxLength={120}
              onChange={(e) => setShopName(e.target.value)}
            />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-xl font-bold">Add your logo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Optional — shown on your customer status page. You can add it later.
            </p>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo preview" className="h-20 w-20 rounded-xl object-contain" />
              ) : (
                <span className="text-3xl" aria-hidden>🖼️</span>
              )}
              <span className="text-sm font-medium text-brand-600">
                {logoFile ? "Change logo" : "Choose an image"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold">Shop phone number</h1>
            <p className="mt-1 text-sm text-slate-500">
              Customers tap this to call you from their status page.
            </p>
            <input
              className="input mt-5"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold">Your most common repair</h1>
            <p className="mt-1 text-sm text-slate-500">
              We&apos;ll make it a one-tap price preset at intake. Add more in Settings.
            </p>
            <label className="label mt-5" htmlFor="preset-label">Repair</label>
            <input
              id="preset-label"
              className="input"
              value={presetLabel}
              maxLength={80}
              onChange={(e) => setPresetLabel(e.target.value)}
            />
            <label className="label mt-4" htmlFor="preset-amount">Price</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">$</span>
              <input
                id="preset-amount"
                className="input pl-8"
                inputMode="decimal"
                value={presetAmount}
                onChange={(e) => setPresetAmount(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold">Your &quot;received&quot; text</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sent automatically when you check an instrument in. Curly-brace
              variables fill in per ticket.
            </p>
            <textarea
              className="input mt-5 min-h-[120px]"
              value={receivedTemplate}
              maxLength={640}
              onChange={(e) => setReceivedTemplate(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["{customer_name}", "{instrument}", "{shop_name}"].map((v) => (
                <code key={v} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {v}
                </code>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStep((s) => s - 1)}
            disabled={saving}
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={saving}
            onClick={finish}
          >
            {saving ? "Setting up…" : "Open my board"}
          </button>
        )}
      </div>
    </main>
  );
}
