import "server-only";

/**
 * Twilio SMS via the REST API directly (basic-auth form POST) — the official
 * SDK would be our only use of a 900-package dependency tree for one endpoint,
 * so we intentionally call the API with fetch instead.
 */

export type SmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export async function sendSms(params: {
  to: string;
  from: string;
  body: string;
}): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { ok: false, error: "SMS is not configured" };
  if (!params.from) return { ok: false, error: "This shop has no SMS number assigned" };

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: params.to,
        From: params.from,
        Body: params.body,
      }),
    },
  );

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    return { ok: false, error: detail?.message ?? `Twilio error ${res.status}` };
  }

  const data = (await res.json()) as { sid: string };
  return { ok: true, sid: data.sid };
}
