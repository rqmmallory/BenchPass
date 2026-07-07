"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dollarsToCents, formatMoney } from "@/lib/format";
import { logoPath, photoUrl } from "@/lib/storage";
import { PLANS } from "@/lib/plan";
import {
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TEMPLATE_VARIABLES,
  type TemplateKey,
} from "@/lib/templates";
import { useToast } from "@/components/Toast";

export type SettingsTab = "shop" | "messages" | "presets" | "billing" | "account";

type Preset = { id: string; label: string; amount_cents: number };

type ShopSettings = {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  plan: "solo" | "shop";
  subscriptionStatus: string;
  trialDaysLeft: number;
  hasStripeCustomer: boolean;
};

const MAX_PRESETS = 20;

const TAB_LABELS: Record<SettingsTab, string> = {
  shop: "Shop",
  messages: "Messages",
  presets: "Price presets",
  billing: "Billing",
  account: "Account",
};

export function SettingsClient({
  initialTab,
  email,
  shop,
  templates,
  presets: initialPresets,
}: {
  initialTab: SettingsTab;
  email: string;
  shop: ShopSettings;
  templates: Record<TemplateKey, { id: string; body: string } | null>;
  presets: Preset[];
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 pb-16">
      <h1 className="mb-3 text-lg font-bold tracking-tight">Settings</h1>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1"
      >
        {(Object.keys(TAB_LABELS) as SettingsTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
              tab === t
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-slide-up">
        {tab === "shop" && <ShopTab shop={shop} />}
        {tab === "messages" && <MessagesTab shopId={shop.id} templates={templates} />}
        {tab === "presets" && <PresetsTab shopId={shop.id} initialPresets={initialPresets} />}
        {tab === "billing" && <BillingTab shop={shop} />}
        {tab === "account" && <AccountTab email={email} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Shop */

function ShopTab({ shop }: { shop: ShopSettings }) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [address, setAddress] = useState(shop.address ?? "");
  const [logo, setLogo] = useState(shop.logoUrl);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast("Shop name can't be empty", "error");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("shops")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast("Could not save shop details", "error");
      return;
    }
    toast("Shop details saved", "success");
    router.refresh();
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = logoPath(shop.id, `logo-${Date.now()}.${ext}`);
    const { error } = await supabase.storage.from("photos").upload(path, file, {
      upsert: true,
    });
    if (error) {
      toast("Logo upload failed", "error");
      return;
    }
    const { error: updateError } = await supabase
      .from("shops")
      .update({ logo_url: path })
      .eq("id", shop.id);
    if (updateError) {
      toast("Could not save logo", "error");
      return;
    }
    setLogo(path);
    toast("Logo updated", "success");
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(logo)}
            alt="Shop logo"
            className="h-16 w-16 rounded-xl bg-slate-100 object-contain"
          />
        ) : (
          <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            🖼️
          </div>
        )}
        <label className="btn-secondary cursor-pointer">
          {logo ? "Change logo" : "Upload logo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void uploadLogo(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div>
        <label className="label" htmlFor="shop-name">Shop name</label>
        <input id="shop-name" className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="shop-phone">Phone</label>
        <input id="shop-phone" className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="shop-address">Address</label>
        <input id="shop-address" className="input" value={address} maxLength={240} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save shop details"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- Messages */

function MessagesTab({
  shopId,
  templates,
}: {
  shopId: string;
  templates: Record<TemplateKey, { id: string; body: string } | null>;
}) {
  const toast = useToast();
  const [bodies, setBodies] = useState<Record<TemplateKey, string>>(() => {
    const initial = {} as Record<TemplateKey, string>;
    for (const key of TEMPLATE_KEYS) initial[key] = templates[key]?.body ?? "";
    return initial;
  });
  const [savingKey, setSavingKey] = useState<TemplateKey | null>(null);

  async function save(key: TemplateKey) {
    const body = bodies[key].trim();
    if (!body) {
      toast("Template can't be empty", "error");
      return;
    }
    setSavingKey(key);
    const supabase = createClient();
    const { error } = await supabase
      .from("templates")
      .upsert({ shop_id: shopId, key, body }, { onConflict: "shop_id,key" });
    setSavingKey(null);
    if (error) {
      toast("Could not save template", "error");
      return;
    }
    toast(`"${TEMPLATE_LABELS[key]}" template saved`, "success");
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm text-slate-600">
          These fill in automatically per ticket. Available variables:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {v}
            </code>
          ))}
        </div>
      </div>

      {TEMPLATE_KEYS.map((key) => (
        <div key={key} className="card p-4">
          <label className="label" htmlFor={`tpl-${key}`}>
            {TEMPLATE_LABELS[key]}
          </label>
          <textarea
            id={`tpl-${key}`}
            className="input min-h-[90px]"
            maxLength={640}
            value={bodies[key]}
            onChange={(e) => setBodies((prev) => ({ ...prev, [key]: e.target.value }))}
          />
          <button
            type="button"
            className="btn-secondary mt-2"
            disabled={savingKey === key}
            onClick={() => void save(key)}
          >
            {savingKey === key ? "Saving…" : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Presets */

function PresetsTab({
  shopId,
  initialPresets,
}: {
  shopId: string;
  initialPresets: Preset[];
}) {
  const toast = useToast();
  const [presets, setPresets] = useState(initialPresets);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const cents = dollarsToCents(amount);
    if (!label.trim() || !cents) {
      toast("Enter a label and a price", "error");
      return;
    }
    if (presets.length >= MAX_PRESETS) {
      toast(`Max ${MAX_PRESETS} presets`, "error");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_presets")
      .insert({ shop_id: shopId, label: label.trim(), amount_cents: cents })
      .select("id, label, amount_cents")
      .single();
    setBusy(false);
    if (error || !data) {
      toast("Could not add preset", "error");
      return;
    }
    setPresets((prev) =>
      [...prev, data].sort((a, b) => a.label.localeCompare(b.label)),
    );
    setLabel("");
    setAmount("");
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("price_presets").delete().eq("id", id);
    if (error) {
      toast("Could not delete preset", "error");
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-2">
          <input
            aria-label="Preset label"
            className="input flex-1"
            placeholder="Full setup"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="relative w-28">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">$</span>
            <input
              aria-label="Preset price"
              className="input pl-7"
              inputMode="decimal"
              placeholder="95"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={() => void add()}>
          Add preset
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          Presets make quoting one tap at intake. Add your common repairs.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{p.label}</span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">
                  {formatMoney(p.amount_cents)}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${p.label}`}
                  className="text-sm text-red-500 hover:underline"
                  onClick={() => void remove(p.id)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Billing */

function BillingTab({ shop }: { shop: ShopSettings }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function go(path: string, body?: Record<string, unknown>) {
    setBusy(path + JSON.stringify(body ?? {}));
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong");
      window.location.href = data.url;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
      setBusy(null);
    }
  }

  const statusCopy: Record<string, string> = {
    trialing:
      shop.trialDaysLeft > 0
        ? `Free trial — ${shop.trialDaysLeft} day${shop.trialDaysLeft === 1 ? "" : "s"} left`
        : "Free trial ended",
    active: "Active",
    past_due: "Payment past due — update your card",
    canceled: "Canceled — read-only",
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm text-slate-500">Current plan</p>
        <p className="mt-0.5 text-xl font-bold">
          {PLANS[shop.plan].name}{" "}
          <span className="text-base font-medium text-slate-500">
            {PLANS[shop.plan].priceLabel}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {statusCopy[shop.subscriptionStatus] ?? shop.subscriptionStatus}
        </p>

        {shop.subscriptionStatus === "active" && shop.hasStripeCustomer ? (
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={busy !== null}
            onClick={() => void go("/api/billing/portal")}
          >
            Manage subscription
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={busy !== null}
            onClick={() => void go("/api/billing/checkout", { plan: shop.plan })}
          >
            Activate subscription
          </button>
        )}
        {shop.hasStripeCustomer && shop.subscriptionStatus !== "active" && (
          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            disabled={busy !== null}
            onClick={() => void go("/api/billing/portal")}
          >
            Open billing portal
          </button>
        )}
      </div>

      {shop.plan === "solo" && (
        <div className="card border-brand-100 bg-brand-50/60 p-4">
          <p className="font-semibold text-brand-900">Upgrade to Shop — $49/mo</p>
          <p className="mt-1 text-sm text-brand-800/80">
            For busier benches: everything in Solo, sized for higher ticket volume.
          </p>
          <button
            type="button"
            className="btn-primary mt-3"
            disabled={busy !== null}
            onClick={() =>
              void go(
                shop.subscriptionStatus === "active"
                  ? "/api/billing/portal"
                  : "/api/billing/checkout",
                shop.subscriptionStatus === "active" ? undefined : { plan: "shop" },
              )
            }
          >
            Upgrade to Shop
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Account */

function AccountTab({ email }: { email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <p className="text-sm text-slate-500">Signed in as</p>
        <p className="font-semibold">{email}</p>
      </div>
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={signingOut}
        onClick={() => void logout()}
      >
        {signingOut ? "Signing out…" : "Log out"}
      </button>
    </div>
  );
}
