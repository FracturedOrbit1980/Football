import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MatchEvent } from "@/lib/club/seed";

export interface PlayerMatchState {
  playerId: string;
  name: string;
  squadNumber: number;
  position: string;
  isOnPitch: boolean;
  /** Derived from the timing fields below; refreshed on every tick. */
  minutesPlayed: number;
  /** Match-clock milliseconds banked from finished spells on the pitch. */
  playedMs: number;
  /** Match-clock milliseconds when the current spell on the pitch began, or null on the bench. */
  onSinceMs: number | null;
  /** Whether the player started the match on the pitch. Reset restores this. */
  startedOnPitch: boolean;
}

export type SquadEntry = Pick<PlayerMatchState, "playerId" | "name" | "squadNumber" | "position" | "isOnPitch">;

interface MatchStore {
  hydrated: boolean;
  /** Stable id for the current match so saving twice updates one record. */
  matchId: string;
  /** Wall-clock ms when the clock was last started, or null while paused. */
  runningSince: number | null;
  /** Match-clock ms accumulated before the current running spell. */
  bankedMs: number;
  matchTimeSeconds: number;
  isClockRunning: boolean;
  players: PlayerMatchState[];
  /** Rotation log and goals, in match-clock milliseconds. */
  events: MatchEvent[];
  ourScore: number;
  theirScore: number;
  addGoal: (side: "for" | "against", delta: 1 | -1) => void;
  startMatchClock: () => void;
  pauseMatchClock: () => void;
  substitutePlayer: (playerOffId: string, playerOnId: string) => void;
  /** Recomputes the clock and minutes from timestamps. Safe to call at any rate. */
  tickSecond: () => void;
  loadSquad: (players: SquadEntry[]) => void;
  resetMatch: () => void;
}

function newMatchId() {
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function elapsedMs(state: Pick<MatchStore, "runningSince" | "bankedMs">, now = Date.now()) {
  return state.bankedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince));
}

function withMinutes(players: PlayerMatchState[], clockMs: number) {
  return players.map((player) => {
    const live = player.onSinceMs === null ? 0 : Math.max(0, clockMs - player.onSinceMs);
    return { ...player, minutesPlayed: (player.playedMs + live) / 60000 };
  });
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      matchId: newMatchId(),
      runningSince: null,
      bankedMs: 0,
      matchTimeSeconds: 0,
      isClockRunning: false,
      players: [],
      events: [],
      ourScore: 0,
      theirScore: 0,
      addGoal: (side, delta) => {
        const state = get();
        const key = side === "for" ? "ourScore" : "theirScore";
        const next = Math.max(0, state[key] + delta);
        if (next === state[key]) return;
        const events =
          delta === 1
            ? [...state.events, { kind: side === "for" ? ("GOAL_FOR" as const) : ("GOAL_AGAINST" as const), atMs: elapsedMs(state) }]
            : state.events;
        set({ [key]: next, events } as Partial<MatchStore>);
      },
      startMatchClock: () => {
        if (get().runningSince !== null) return;
        set({ runningSince: Date.now(), isClockRunning: true });
      },
      pauseMatchClock: () => {
        const state = get();
        if (state.runningSince === null) return;
        const clock = elapsedMs(state);
        set({
          runningSince: null,
          bankedMs: clock,
          isClockRunning: false,
          matchTimeSeconds: Math.floor(clock / 1000),
          players: withMinutes(state.players, clock),
        });
      },
      substitutePlayer: (playerOffId, playerOnId) => {
        if (!playerOffId || !playerOnId || playerOffId === playerOnId) return;
        const state = get();
        const off = state.players.find((player) => player.playerId === playerOffId);
        const on = state.players.find((player) => player.playerId === playerOnId);
        if (!off?.isOnPitch || !on || on.isOnPitch) return;
        const clock = elapsedMs(state);
        const players = state.players.map((player) => {
          if (player.playerId === playerOffId) {
            const live = player.onSinceMs === null ? 0 : Math.max(0, clock - player.onSinceMs);
            return { ...player, isOnPitch: false, playedMs: player.playedMs + live, onSinceMs: null };
          }
          if (player.playerId === playerOnId) return { ...player, isOnPitch: true, onSinceMs: clock };
          return player;
        });
        set({
          players: withMinutes(players, clock),
          events: [...state.events, { kind: "SUB", atMs: clock, offId: playerOffId, onId: playerOnId }],
        });
      },
      tickSecond: () => {
        const state = get();
        const clock = elapsedMs(state);
        set({ matchTimeSeconds: Math.floor(clock / 1000), players: withMinutes(state.players, clock) });
      },
      loadSquad: (squad) =>
        set({
          events: [],
          ourScore: 0,
          theirScore: 0,
          matchId: newMatchId(),
          runningSince: null,
          bankedMs: 0,
          matchTimeSeconds: 0,
          isClockRunning: false,
          players: squad.map((player) => ({
            ...player,
            minutesPlayed: 0,
            playedMs: 0,
            onSinceMs: player.isOnPitch ? 0 : null,
            startedOnPitch: player.isOnPitch,
          })),
        }),
      resetMatch: () =>
        set((state) => ({
          events: [],
          ourScore: 0,
          theirScore: 0,
          matchId: newMatchId(),
          runningSince: null,
          bankedMs: 0,
          matchTimeSeconds: 0,
          isClockRunning: false,
          players: state.players.map((player) => ({
            ...player,
            isOnPitch: player.startedOnPitch,
            minutesPlayed: 0,
            playedMs: 0,
            onSinceMs: player.startedOnPitch ? 0 : null,
          })),
        })),
    }),
    {
      name: "football-live-match",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        matchId: state.matchId,
        runningSince: state.runningSince,
        bankedMs: state.bankedMs,
        players: state.players,
        events: state.events,
        ourScore: state.ourScore,
        theirScore: state.theirScore,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<MatchStore>;
        const next = { ...current, ...saved, events: saved.events ?? [], ourScore: saved.ourScore ?? 0, theirScore: saved.theirScore ?? 0, hydrated: true };
        const clock = elapsedMs(next);
        return {
          ...next,
          isClockRunning: next.runningSince !== null,
          matchTimeSeconds: Math.floor(clock / 1000),
          players: withMinutes(next.players ?? [], clock),
        };
      },
    },
  ),
);

export async function hydrateMatchStore() {
  if (useMatchStore.getState().hydrated) return;
  await useMatchStore.persist.rehydrate();
  useMatchStore.setState({ hydrated: true });
}
