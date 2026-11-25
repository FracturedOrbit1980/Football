import { create } from "zustand";

import type { MatchEvent } from "@/lib/club/seed";

export interface PlayerMatchState {
  playerId: string;
  name: string;
  squadNumber: number;
  position: string;
  isOnPitch: boolean;
  /** Derived from match-clock timing fields, never an interval counter. */
  minutesPlayed: number;
  playedMs: number;
  onSinceMs: number | null;
  startedOnPitch: boolean;
}

export type SquadEntry = Pick<PlayerMatchState, "playerId" | "name" | "squadNumber" | "position" | "isOnPitch">;
export type MatchLayout = { playerId: string; x: number; y: number }[] | null;

interface MatchSession {
  version: 2;
  matchId: string;
  clubId: string;
  teamId: string;
  opponent: string;
  runningSince: number | null;
  bankedMs: number;
  matchTimeSeconds: number;
  players: PlayerMatchState[];
  events: MatchEvent[];
  ourScore: number;
  theirScore: number;
  formation: string;
  layout: MatchLayout;
}

interface MatchStore extends Omit<MatchSession, "version"> {
  hydrated: boolean;
  isClockRunning: boolean;
  recovered: boolean;
  storageWarning: string;
  openMatch: (clubId: string, teamId: string, players: SquadEntry[]) => void;
  setOpponent: (opponent: string) => void;
  setFormation: (formation: string) => void;
  setLayout: (layout: MatchLayout) => void;
  addGoal: (side: "for" | "against", delta: 1 | -1) => void;
  startMatchClock: () => void;
  pauseMatchClock: () => void;
  substitutePlayer: (playerOffId: string, playerOnId: string) => void;
  tickSecond: () => void;
  loadSquad: (players: SquadEntry[]) => void;
  resetMatch: (players?: SquadEntry[]) => void;
  clearDeviceState: () => void;
}

export const matchStorageKey = (clubId: string, teamId: string) =>
  `cs.football.match.v1.${encodeURIComponent(clubId).replace(/\./g, "%2E")}.${encodeURIComponent(teamId).replace(/\./g, "%2E")}`;

const unavailable = "Match recovery is unavailable on this device. Keep this page open to retain unsaved minutes.";
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function elapsedMs(state: Pick<MatchStore, "runningSince" | "bankedMs">, now = Date.now()) {
  return state.bankedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince));
}

function withMinutes(players: PlayerMatchState[], clockMs: number) {
  return players.map((player) => ({ ...player,
    minutesPlayed: (player.playedMs + (player.onSinceMs === null ? 0 : Math.max(0, clockMs - player.onSinceMs))) / 60000 }));
}

function freshPlayers(squad: SquadEntry[]): PlayerMatchState[] {
  return squad.map((player) => ({ ...player, minutesPlayed: 0, playedMs: 0,
    onSinceMs: player.isOnPitch ? 0 : null, startedOnPitch: player.isOnPitch }));
}

function hasMatchActivity(state: Pick<MatchSession, "events" | "ourScore" | "theirScore" | "layout">) {
  return state.events.length > 0 || state.ourScore > 0 || state.theirScore > 0 || Boolean(state.layout?.length);
}

function reconcileSquad(squad: SquadEntry[], previous: PlayerMatchState[], keepMembership: boolean) {
  if (!keepMembership) return freshPlayers(squad);
  // Event actors and saved pitch spots remain valid even if allocation changes before kickoff.
  return previous.map((player) => {
    const updated = squad.find((row) => row.playerId === player.playerId);
    return updated ? { ...player, name: updated.name, squadNumber: updated.squadNumber, position: updated.position } : player;
  });
}

function newMatchId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `match-${crypto.randomUUID()}` : `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSession(raw: string, clubId: string, teamId: string): MatchSession | null {
  try {
    const value = JSON.parse(raw);
    if (!value || ![1, 2].includes(value.version) || value.clubId !== clubId || value.teamId !== teamId ||
      !text(value.matchId) || typeof value.opponent !== "string" || value.opponent.length > 200 ||
      !Array.isArray(value.players) || value.players.length > 100) return null;
    const clock = value.version === 1 ? value.matchTimeSeconds * 1000 : value.bankedMs;
    if (!positive(clock) || !Number.isSafeInteger(Math.floor(clock))) return null;
    const ids = new Set<string>();
    const players: PlayerMatchState[] = [];
    for (const row of value.players) {
      if (!row || !text(row.playerId) || ids.has(row.playerId) || !text(row.name) || !text(row.position) ||
        !Number.isInteger(row.squadNumber) || row.squadNumber < 0 || row.squadNumber > 99 || typeof row.isOnPitch !== "boolean") return null;
      ids.add(row.playerId);
      const playedMs = value.version === 1 ? row.minutesPlayed * 60000 : row.playedMs;
      const onSinceMs = value.version === 1 ? (row.isOnPitch ? clock : null) : row.onSinceMs;
      const startedOnPitch = value.version === 1 ? row.isOnPitch : row.startedOnPitch;
      if (!positive(playedMs) || playedMs > clock + 0.01 || typeof startedOnPitch !== "boolean" ||
        (onSinceMs !== null && (!positive(onSinceMs) || onSinceMs > clock)) ||
        (row.isOnPitch !== (onSinceMs !== null))) return null;
      players.push({ playerId: row.playerId, name: row.name, squadNumber: row.squadNumber, position: row.position,
        isOnPitch: row.isOnPitch, minutesPlayed: 0, playedMs, onSinceMs, startedOnPitch });
    }
    const events: MatchEvent[] = [];
    for (const event of value.version === 1 ? [] : value.events ?? []) {
      if (!event || !["SUB", "GOAL_FOR", "GOAL_AGAINST"].includes(event.kind) || !positive(event.atMs) || event.atMs > clock) return null;
      if (event.kind === "SUB" && (!ids.has(event.offId) || !ids.has(event.onId) || event.offId === event.onId)) return null;
      events.push(event.kind === "SUB" ? { kind: "SUB", atMs: event.atMs, offId: event.offId, onId: event.onId }
        : { kind: event.kind, atMs: event.atMs });
    }
    const ourScore = value.ourScore ?? 0, theirScore = value.theirScore ?? 0;
    if (!Number.isSafeInteger(ourScore) || ourScore < 0 || !Number.isSafeInteger(theirScore) || theirScore < 0) return null;
    let layout: MatchLayout = null;
    if (value.layout !== undefined && value.layout !== null) {
      if (!Array.isArray(value.layout) || value.layout.length > 100) return null;
      layout = [];
      for (const spot of value.layout) {
        if (!spot || !ids.has(spot.playerId) || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return null;
        layout.push({ playerId: spot.playerId, x: spot.x, y: spot.y });
      }
    }
    if (value.formation !== undefined && !text(value.formation)) return null;
    // Whitelist data only. Scoped v1 snapshots are migrated; the unscoped PR singleton is never guessed into a club.
    return { version: 2, matchId: value.matchId, clubId, teamId, opponent: value.opponent,
      runningSince: null, bankedMs: clock, matchTimeSeconds: Math.floor(clock / 1000), players: withMinutes(players, clock),
      events, ourScore, theirScore, formation: value.formation ?? "4-4-2", layout };
  } catch {
    return null;
  }
}

function sessionOf(state: MatchStore): MatchSession {
  const clock = elapsedMs(state);
  return { version: 2, matchId: state.matchId, clubId: state.clubId, teamId: state.teamId, opponent: state.opponent,
    runningSince: null, bankedMs: clock, matchTimeSeconds: Math.floor(clock / 1000),
    players: withMinutes(state.players, clock), events: state.events.map((event) => ({ ...event })),
    ourScore: state.ourScore, theirScore: state.theirScore, formation: state.formation,
    layout: state.layout?.map((spot) => ({ ...spot })) ?? null };
}

const empty = { matchId: "", clubId: "", teamId: "", opponent: "", runningSince: null, bankedMs: 0,
  matchTimeSeconds: 0, players: [] as PlayerMatchState[], events: [] as MatchEvent[], ourScore: 0, theirScore: 0,
  formation: "4-4-2", layout: null as MatchLayout };

export function createMatchStore() {
  const sessions = new Map<string, MatchSession>();
  function persistSession(state: MatchStore): string {
    if (!state.clubId || !state.teamId || !state.matchId) return "";
    const key = matchStorageKey(state.clubId, state.teamId);
    const session = sessionOf(state);
    sessions.set(key, session);
    try {
      if (typeof localStorage === "undefined") return unavailable;
      localStorage.setItem(key, JSON.stringify(session));
      return "";
    } catch { return unavailable; }
  }
  return create<MatchStore>((set, get) => {
    const commit = (patch: Partial<MatchStore>) => {
      const next = { ...get(), ...patch };
      set({ ...patch, storageWarning: persistSession(next) });
    };
    const reset = (squad?: SquadEntry[]) => {
      const state = get();
      if (!state.matchId) return;
      const players = squad ?? state.players.map((player) => ({ ...player, isOnPitch: player.startedOnPitch }));
      commit({ ...empty, clubId: state.clubId, teamId: state.teamId, matchId: newMatchId(), formation: state.formation, players: freshPlayers(players),
        isClockRunning: false, recovered: false });
    };
    return {
      ...empty, hydrated: false, isClockRunning: false, recovered: false, storageWarning: "",
      openMatch: (clubId, teamId, squad) => {
        const current = get();
        if (current.clubId === clubId && current.teamId === teamId && current.matchId) {
          if (elapsedMs(current) > 0 || current.isClockRunning) return;
          const players = reconcileSquad(squad, current.players, hasMatchActivity(current));
          if (JSON.stringify(current.players) !== JSON.stringify(players)) commit({ players });
          return;
        }
        persistSession(current);
        if (!clubId || !teamId) { set({ ...empty, hydrated: true, isClockRunning: false, recovered: false, storageWarning: "" }); return; }
        const key = matchStorageKey(clubId, teamId);
        let stored = sessions.get(key) ?? null, warning = "";
        if (!stored) {
          try {
            const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
            if (raw) { stored = parseSession(raw, clubId, teamId); if (!stored) warning = "The saved match could not be recovered. A new paused match is ready."; }
          } catch { warning = unavailable; }
        }
        if (stored && stored.bankedMs === 0) {
          stored = { ...stored, players: reconcileSquad(squad, stored.players, hasMatchActivity(stored)) };
        }
        const session = stored ?? { ...empty, version: 2 as const, matchId: newMatchId(), clubId, teamId, players: freshPlayers(squad) };
        const next = { ...current, ...session, hydrated: true, isClockRunning: false,
          recovered: Boolean(stored && (stored.bankedMs > 0 || stored.opponent)) };
        const storageWarning = persistSession(next);
        set({ ...session, hydrated: true, isClockRunning: false, recovered: next.recovered, storageWarning: warning || storageWarning });
      },
      setOpponent: (opponent) => commit({ opponent: opponent.slice(0, 200) }),
      setFormation: (formation) => commit({ formation: formation.slice(0, 200), layout: null }),
      setLayout: (layout) => commit({ layout }),
      addGoal: (side, delta) => {
        const state = get();
        if (!state.matchId) return;
        const key = side === "for" ? "ourScore" : "theirScore";
        const next = Math.max(0, state[key] + delta);
        if (next === state[key]) return;
        const clock = elapsedMs(state);
        commit({ [key]: next, events: delta === 1 ? [...state.events, { kind: side === "for" ? "GOAL_FOR" : "GOAL_AGAINST", atMs: clock }] : state.events });
      },
      startMatchClock: () => {
        if (!get().matchId || get().players.length === 0 || get().runningSince !== null) return;
        commit({ runningSince: Date.now(), isClockRunning: true, recovered: false });
      },
      pauseMatchClock: () => {
        const state = get();
        if (state.runningSince === null) return;
        const clock = elapsedMs(state);
        commit({ runningSince: null, bankedMs: clock, isClockRunning: false, matchTimeSeconds: Math.floor(clock / 1000), players: withMinutes(state.players, clock) });
      },
      substitutePlayer: (playerOffId, playerOnId) => {
        const state = get();
        const off = state.players.find((player) => player.playerId === playerOffId), on = state.players.find((player) => player.playerId === playerOnId);
        if (!off?.isOnPitch || !on || on.isOnPitch || playerOffId === playerOnId) return;
        const clock = elapsedMs(state);
        const players = state.players.map((player) => player.playerId === playerOffId
          ? { ...player, isOnPitch: false, playedMs: player.playedMs + (player.onSinceMs === null ? 0 : Math.max(0, clock - player.onSinceMs)), onSinceMs: null }
          : player.playerId === playerOnId ? { ...player, isOnPitch: true, onSinceMs: clock } : player);
        commit({ players: withMinutes(players, clock), events: [...state.events, { kind: "SUB", atMs: clock, offId: playerOffId, onId: playerOnId }] });
      },
      tickSecond: () => {
        const state = get(), clock = elapsedMs(state);
        commit({ matchTimeSeconds: Math.floor(clock / 1000), players: withMinutes(state.players, clock) });
      },
      loadSquad: (squad) => reset(squad),
      resetMatch: reset,
      clearDeviceState: () => { sessions.clear(); set({ ...empty, hydrated: true, isClockRunning: false, recovered: false, storageWarning: "" }); },
    };
  });
}

export const useMatchStore = createMatchStore();
export function clearAllMatchSessions() { useMatchStore.getState().clearDeviceState(); }
export async function hydrateMatchStore() { useMatchStore.setState({ hydrated: true }); }
