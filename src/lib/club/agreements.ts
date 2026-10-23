import { isIsoDate, paidSince, todayIso } from "@/lib/club/accounting";
import type { ClubPlayer, PaymentPlan, PlanInstalment, PromiseToPay } from "@/lib/club/seed";
import { parseIso } from "@/lib/club/week";

export const PLAN_FREQUENCIES = ["Weekly", "Fortnightly", "Monthly"] as const;

export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number];

export type PlanStatus = "Completed" | "Instalment missed" | "On track";

export type PromiseStatus = "Kept" | "Overdue" | "Open";

export interface InstalmentRow extends PlanInstalment {
  settled: boolean;
  missed: boolean;
}

export interface PlanProgress {
  total: number;
  paid: number;
  remaining: number;
  settled: number;
  missed: number;
  next: InstalmentRow | null;
  status: PlanStatus;
  rows: InstalmentRow[];
}

function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function stepDate(from: string, steps: number, frequency: PlanFrequency) {
  const date = parseIso(from);
  if (frequency === "Weekly") date.setDate(date.getDate() + 7 * steps);
  else if (frequency === "Fortnightly") date.setDate(date.getDate() + 14 * steps);
  else date.setMonth(date.getMonth() + steps);
  return toIso(date);
}

export function buildPlan(
  input: { amount: number; instalments: number; firstDue: string; frequency: PlanFrequency },
  id = `plan-${Date.now()}`,
): PaymentPlan {
  const total = Math.max(0, Math.round(input.amount));
  const count = Math.min(24, Math.max(1, Math.round(input.instalments)));
  const start = isIsoDate(input.firstDue) ? input.firstDue : todayIso();
  const base = Math.floor(total / count);
  return {
    id,
    agreedOn: todayIso(),
    instalments: Array.from({ length: count }, (_, index) => ({
      id: `${id}-${index + 1}`,
      dueDate: stepDate(start, index, input.frequency),
      amount: index === count - 1 ? total - base * (count - 1) : base,
    })),
  };
}

export function planProgress(player: ClubPlayer, today = todayIso()): PlanProgress | null {
  const plan = player.paymentPlan;
  if (!plan || plan.instalments.length === 0) return null;
  const paid = paidSince(player, plan.agreedOn);
  let covered = 0;
  const rows = [...plan.instalments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((instalment) => {
      covered += instalment.amount;
      const settled = paid >= covered;
      return { ...instalment, settled, missed: !settled && instalment.dueDate < today };
    });
  const settled = rows.filter((row) => row.settled).length;
  const missed = rows.filter((row) => row.missed).length;
  const status: PlanStatus =
    settled === rows.length ? "Completed" : missed > 0 ? "Instalment missed" : "On track";
  return {
    total: covered,
    paid: Math.min(paid, covered),
    remaining: Math.max(0, covered - paid),
    settled,
    missed,
    next: rows.find((row) => !row.settled) ?? null,
    status,
    rows,
  };
}

export function promiseStatus(player: ClubPlayer, today = todayIso()): PromiseStatus | null {
  const promise = player.promise;
  if (!promise) return null;
  if (paidSince(player, promise.notedOn) >= promise.amount) return "Kept";
  return promise.date < today ? "Overdue" : "Open";
}

export function normalizePlan(value: unknown): PaymentPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<PaymentPlan>;
  if (!Array.isArray(plan.instalments)) return null;
  const instalments = plan.instalments
    .map((item) => item as Partial<PlanInstalment> | null)
    .filter((item): item is Partial<PlanInstalment> => Boolean(item))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : `plan-instalment-${index}`,
      dueDate: isIsoDate(item.dueDate) ? item.dueDate : todayIso(),
      amount: Number.isFinite(item.amount) ? Math.max(0, Math.round(item.amount as number)) : 0,
    }))
    .filter((item) => item.amount > 0);
  if (instalments.length === 0) return null;
  return {
    id: typeof plan.id === "string" && plan.id ? plan.id : `plan-${instalments[0].dueDate}`,
    agreedOn: isIsoDate(plan.agreedOn) ? plan.agreedOn : instalments[0].dueDate,
    instalments,
  };
}

export function normalizePromise(value: unknown): PromiseToPay | null {
  if (!value || typeof value !== "object") return null;
  const promise = value as Partial<PromiseToPay>;
  const amount = Number.isFinite(promise.amount) ? Math.max(0, Math.round(promise.amount as number)) : 0;
  if (!isIsoDate(promise.date) || amount <= 0) return null;
  return {
    date: promise.date,
    amount,
    notedOn: isIsoDate(promise.notedOn) ? promise.notedOn : promise.date,
  };
}
