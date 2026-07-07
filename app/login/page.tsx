"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-fab" aria-hidden>
            🎸
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BenchPass</h1>
          <p className="mt-1 text-sm text-slate-500">
            Repair tickets and customer updates, minus the paper tags.
          </p>
        </div>

        {state === "sent" ? (
          <div className="card animate-slide-up p-6 text-center">
            <p className="text-3xl" aria-hidden>📬</p>
            <h2 className="mt-3 text-lg font-semibold">Check your email</h2>
            <p className="mt-1 text-sm text-slate-500">
              We sent a login link to <strong>{email}</strong>. Tap it on this
              device to sign in.
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-4 text-sm font-medium text-brand-600 underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6">
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@yourshop.com"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="btn-primary mt-4 w-full"
            >
              {state === "sending" ? "Sending…" : "Send magic link"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              No password needed. First login creates your account.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
