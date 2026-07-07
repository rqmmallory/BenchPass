import "server-only";

/**
 * Resend transactional email via the REST API directly with fetch —
 * one endpoint doesn't justify another dependency.
 */

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  fromName?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email is not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${params.fromName ?? "BenchPass"} <notifications@benchpass.app>`,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    return { ok: false, error: detail?.message ?? `Resend error ${res.status}` };
  }

  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}
