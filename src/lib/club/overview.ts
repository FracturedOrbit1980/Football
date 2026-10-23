import { clubDataKey, type ClubProfile } from "@/lib/club/registry";

export interface ClubAccountSummary {
  players: number;
  received: number;
  outstanding: number;
}

const EMPTY: ClubAccountSummary = { players: 0, received: 0, outstanding: 0 };

export function readClubAccountSummary(club: ClubProfile): ClubAccountSummary {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(clubDataKey(club.id));
  if (!raw) return EMPTY;
  try {
    const state = (JSON.parse(raw) as { state?: { players?: unknown } }).state;
    if (!Array.isArray(state?.players)) return EMPTY;
    return state.players.reduce<ClubAccountSummary>((sum, value) => {
      const player = value as { seasonFee?: unknown; payments?: unknown };
      const fee = typeof player.seasonFee === "number" ? player.seasonFee : 0;
      const payments = Array.isArray(player.payments) ? player.payments : [];
      const received = payments.reduce((total, payment) => {
        const amount = (payment as { amount?: unknown } | null)?.amount;
        return total + (typeof amount === "number" ? amount : 0);
      }, 0);
      return {
        players: sum.players + 1,
        received: sum.received + received,
        outstanding: sum.outstanding + Math.max(0, fee - received),
      };
    }, EMPTY);
  } catch {
    return EMPTY;
  }
}
