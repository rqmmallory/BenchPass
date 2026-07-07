export const TEMPLATE_KEYS = [
  "received",
  "ready",
  "quote_update",
  "reminder",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  received: "Received",
  ready: "Ready for pickup",
  quote_update: "Quote update",
  reminder: "Pickup reminder",
};

export const TEMPLATE_VARIABLES = [
  "{customer_name}",
  "{instrument}",
  "{shop_name}",
  "{public_url}",
  "{quote}",
] as const;

export type TemplateVars = {
  customer_name: string;
  instrument: string;
  shop_name: string;
  public_url: string;
  quote: string;
};

/** Replace every {variable} occurrence; unknown variables are left intact. */
export function resolveTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : match,
  );
}

/** Human label for an instrument: "Fender Stratocaster", "Guitar", or "instrument". */
export function instrumentLabel(instrument: {
  type?: string | null;
  make?: string | null;
  model?: string | null;
} | null): string {
  if (!instrument) return "instrument";
  const makeModel = [instrument.make, instrument.model].filter(Boolean).join(" ");
  return makeModel || instrument.type || "instrument";
}
