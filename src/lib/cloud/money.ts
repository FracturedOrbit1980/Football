const ZAR = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function formatZar(cents: number) {
  return ZAR.format(cents / 100);
}

/** Parses "250", "250.50" or "R 1 250,50" into cents. Returns null when unreadable. */
export function parseRandToCents(text: string): number | null {
  const cleaned = text.replace(/[Rr\s]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
