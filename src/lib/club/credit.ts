import { daysOverdue, isIsoDate, outstandingOf, todayIso } from "@/lib/club/accounting";
import { planProgress, promiseStatus } from "@/lib/club/agreements";
import type { ClubPlayer, CorrespondenceEntry } from "@/lib/club/seed";

export type ChaseStage = "Reminder" | "Second reminder" | "Final demand" | "Handover";

export type ChaseHold = "Promise" | "Agreement";

export interface ChaseState {
  days: number;
  stage: ChaseStage;
  outstanding: number;
  hold: ChaseHold | null;
}

export interface CreditSummary {
  chase: number;
  held: number;
  overdue: number;
  oldest: number;
  broken: number;
}

function chaseStage(days: number): ChaseStage {
  if (days <= 30) return "Reminder";
  if (days <= 60) return "Second reminder";
  if (days <= 90) return "Final demand";
  return "Handover";
}

export function chaseState(player: ClubPlayer, today = todayIso()): ChaseState | null {
  const outstanding = outstandingOf(player);
  if (outstanding <= 0) return null;
  const days = daysOverdue(player, today);
  if (days <= 0) return null;
  const plan = planProgress(player, today);
  const hold: ChaseHold | null =
    promiseStatus(player, today) === "Open" ? "Promise" : plan?.status === "On track" ? "Agreement" : null;
  return { days, stage: chaseStage(days), outstanding, hold };
}

export function creditSummary(players: ClubPlayer[], today = todayIso()): CreditSummary {
  let chase = 0;
  let held = 0;
  let overdue = 0;
  let oldest = 0;
  let broken = 0;
  for (const player of players) {
    if (outstandingOf(player) > 0) {
      const promise = promiseStatus(player, today);
      const plan = planProgress(player, today);
      if (promise === "Overdue" || plan?.status === "Instalment missed") broken += 1;
    }
    const state = chaseState(player, today);
    if (!state) continue;
    overdue += state.outstanding;
    oldest = Math.max(oldest, state.days);
    if (state.hold) held += 1;
    else chase += 1;
  }
  return { chase, held, overdue, oldest, broken };
}

export function lastContact(player: ClubPlayer): CorrespondenceEntry | null {
  let latest: CorrespondenceEntry | null = null;
  for (const entry of player.correspondence) {
    if (entry.channel === "Registration") continue;
    if (!latest || entry.date > latest.date) latest = entry;
  }
  return latest;
}

export function daysSince(iso: string, today = todayIso()) {
  if (!isIsoDate(iso) || !isIsoDate(today)) return 0;
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000));
}
