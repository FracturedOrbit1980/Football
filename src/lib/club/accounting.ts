import type { ClubPlayer } from "@/lib/club/seed";

export const AGE_BUCKETS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

export type AgeBucket = (typeof AGE_BUCKETS)[number];

export interface AgeBucketTotal {
  amount: number;
  count: number;
}

export type AgeAnalysis = Record<AgeBucket, AgeBucketTotal>;

const randFormat = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

export function rand(value: number) {
  return `R ${randFormat.format(Math.max(0, Math.round(value)))}`;
}

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(dayNumber(value));
}

function dayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function paidTotal(player: ClubPlayer) {
  return player.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function paidSince(player: ClubPlayer, fromIso: string) {
  if (!isIsoDate(fromIso)) return paidTotal(player);
  return player.payments
    .filter((payment) => payment.date >= fromIso)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function sponsorCreditOf(player: ClubPlayer) {
  const sponsored = Number.isFinite(player.sponsoredAmount) ? player.sponsoredAmount : 0;
  return Math.max(0, Math.min(Math.round(sponsored), Math.max(0, player.seasonFee)));
}

export function chargedOf(player: ClubPlayer) {
  return Math.max(0, player.seasonFee - sponsorCreditOf(player));
}

export function outstandingOf(player: ClubPlayer) {
  return Math.max(0, chargedOf(player) - paidTotal(player));
}

export function creditOf(player: ClubPlayer) {
  return Math.max(0, paidTotal(player) - chargedOf(player));
}

export function daysOverdue(player: ClubPlayer, today = todayIso()) {
  if (!player.feeDueDate || !isIsoDate(player.feeDueDate) || outstandingOf(player) <= 0) return 0;
  return Math.max(0, Math.round(dayNumber(today) - dayNumber(player.feeDueDate)));
}

export function bucketOf(days: number): AgeBucket {
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

export function ageAnalysis(players: ClubPlayer[], today = todayIso()): AgeAnalysis {
  const summary = Object.fromEntries(
    AGE_BUCKETS.map((bucket) => [bucket, { amount: 0, count: 0 }]),
  ) as AgeAnalysis;
  for (const player of players) {
    const outstanding = outstandingOf(player);
    if (outstanding <= 0) continue;
    const bucket = bucketOf(daysOverdue(player, today));
    summary[bucket].amount += outstanding;
    summary[bucket].count += 1;
  }
  return summary;
}
