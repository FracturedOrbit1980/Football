import { expect, test } from "@playwright/test";
import { createJSONStorage } from "zustand/middleware";
import type { SquadEntry } from "../src/stores/match-store";

let matchModule: typeof import("../src/stores/match-store");
let clubModule: typeof import("../src/stores/club-store");
const cache = new Map<string, string>();
let unavailable = false;
let now = 1_700_000_000_000;
const realDateNow = Date.now;
const storage = {
  getItem(key: string) { if (unavailable) throw new Error("storage blocked"); return cache.get(key) ?? null; },
  setItem(key: string, value: string) { if (unavailable) throw new Error("storage full"); cache.set(key, value); },
  removeItem(key: string) { cache.delete(key); },
};
const squad: SquadEntry[] = [
  { playerId: "qa-a1", name: "QA Alpha Keeper", squadNumber: 1, position: "GK", isOnPitch: true },
  { playerId: "qa-a2", name: "QA Alpha Reserve", squadNumber: 12, position: "ST", isOnPitch: false },
];
const beta: SquadEntry[] = [
  { playerId: "qa-b1", name: "QA Beta Keeper", squadNumber: 1, position: "GK", isOnPitch: true },
];

test.beforeAll(async () => {
  // Dynamic imports initialize the actual Zustand stores against synthetic storage only.
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  matchModule = await import("../src/stores/match-store");
  clubModule = await import("../src/stores/club-store");
});
test.beforeEach(() => { unavailable = false; cache.clear(); now = 1_700_000_000_000; Date.now = () => now; });
test.afterEach(() => { Date.now = realDateNow; });

function advance(store: ReturnType<typeof import("../src/stores/match-store").createMatchStore>, milliseconds = 1000) {
  now += milliseconds;
  store.getState().tickSecond();
}

function setupSave() {
  const club = clubModule.useClubStore;
  club.persist.setOptions({ name: "bnfc-club-qa-club-a", storage: createJSONStorage(() => storage) });
  club.setState({ clubKind: "custom", coachTeamId: "qa-team-a",
    ageGroups: [{ id: "qa-u12", name: "U12", displayOrder: 12, teams: [
      { id: "qa-team-a", name: "Prem", division: "Prem" }, { id: "qa-team-b", name: "Div 1", division: "Div 1" },
    ] }],
    players: squad.map((player) => ({ id: player.playerId, name: player.name, firstName: "QA Alpha", surname: "Test",
      squadNumber: player.squadNumber, position: player.position, teamId: "qa-team-a", regNumber: "", idNumber: "", mobile: "",
      correspondence: [], homework: "", seasonFee: 0, sponsoredAmount: 0, feeDueDate: "", payments: [], paymentPlan: null,
      promise: null, guardianName: "", guardianEmail: "", accessPin: "" })),
    matches: [{ id: "legacy-match", teamId: "qa-team-a", opponent: "QA Legacy", playedOn: "1 Jan 2026", minutes: [] }],
    attendance: [],
  });
  const match = matchModule.useMatchStore;
  match.getState().openMatch("qa-club-a", "qa-team-a", squad);
  match.getState().resetMatch(squad);
  match.getState().setOpponent("QA Opponent");
  return { club, match, save: () => {
    const current = match.getState();
    return club.getState().saveMatch(current.matchId, current.clubId, current.teamId, current.opponent,
      current.players.map(({ playerId, minutesPlayed }) => ({ playerId, minutesPlayed })));
  } };
}

test("match sessions pause and retain attribution when switching team or club", () => {
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  const alphaId = store.getState().matchId;
  store.getState().setOpponent("QA Opponent A");
  store.getState().startMatchClock();
  for (let i = 0; i < 60; i++) advance(store);
  store.getState().substitutePlayer("qa-a1", "qa-a2");
  for (let i = 0; i < 60; i++) advance(store);
  store.getState().openMatch("qa-club-a", "qa-team-b", beta);
  expect(store.getState().players.map((p) => p.playerId)).toEqual(["qa-b1"]);
  expect(store.getState().matchTimeSeconds).toBe(0);
  expect(store.getState().isClockRunning).toBe(false);
  advance(store);
  expect(store.getState().matchTimeSeconds).toBe(0);
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(store.getState().matchId).toBe(alphaId);
  expect(store.getState().matchTimeSeconds).toBe(120);
  expect(store.getState().opponent).toBe("QA Opponent A");
  expect(store.getState().isClockRunning).toBe(false);
  expect(store.getState().players.map((p) => p.minutesPlayed)).toEqual([expect.closeTo(1), expect.closeTo(1)]);
  store.getState().openMatch("qa-club-b", "qa-team-a", beta);
  expect(store.getState().matchId).not.toBe(alphaId);
  expect(store.getState().players[0].playerId).toBe("qa-b1");
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(store.getState().matchId).toBe(alphaId);
});

test("pre-kickoff metadata refresh retains match identity, lineup, events and score", () => {
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  const id = store.getState().matchId;
  store.getState().substitutePlayer("qa-a1", "qa-a2");
  store.getState().addGoal("for", 1);
  store.getState().setFormation("4-3-3");
  const events = store.getState().events;
  const updated = squad.map((player) => ({ ...player, name: `${player.name} Updated`,
    squadNumber: player.squadNumber + 1, position: "CB" }));
  store.getState().openMatch("qa-club-a", "qa-team-a", updated);
  expect(store.getState().players[0]).toMatchObject({ name: "QA Alpha Keeper Updated", squadNumber: 2, position: "CB", isOnPitch: false, playedMs: 0 });
  expect(store.getState().players[1].isOnPitch).toBe(true);
  expect(store.getState().matchId).toBe(id);
  expect(store.getState().events).toEqual(events);
  expect(store.getState().ourScore).toBe(1);
  store.getState().openMatch("qa-club-a", "qa-team-b", beta);
  const latest = updated.map((player) => ({ ...player, name: `${player.name} Again`, position: "LB" }));
  store.getState().openMatch("qa-club-a", "qa-team-a", latest);
  expect(store.getState().players[0]).toMatchObject({ name: "QA Alpha Keeper Updated Again", position: "LB", isOnPitch: false });
  expect(store.getState().players[1].isOnPitch).toBe(true);
  expect(store.getState().matchId).toBe(id);
  expect(store.getState().events).toEqual(events);
  expect(store.getState().ourScore).toBe(1);
  expect(store.getState().formation).toBe("4-3-3");
});

test("zero-time event membership survives allocation changes and fresh-store recovery", () => {
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  const id = store.getState().matchId;
  store.getState().substitutePlayer("qa-a1", "qa-a2");
  store.getState().addGoal("for", 1);
  const events = store.getState().events;
  const remaining = [{ ...squad[1], name: "QA Remaining Updated", position: "RW" }];
  store.getState().openMatch("qa-club-a", "qa-team-a", remaining);
  expect(store.getState().players.map((player) => player.playerId)).toEqual(["qa-a1", "qa-a2"]);
  expect(store.getState().players[1]).toMatchObject({ name: "QA Remaining Updated", position: "RW", isOnPitch: true });
  store.getState().openMatch("qa-club-a", "qa-team-b", beta);
  store.getState().openMatch("qa-club-a", "qa-team-a", remaining);
  const reloaded = matchModule.createMatchStore();
  reloaded.getState().openMatch("qa-club-a", "qa-team-a", remaining);
  expect(reloaded.getState().matchId).toBe(id);
  expect(reloaded.getState().events).toEqual(events);
  expect(reloaded.getState().ourScore).toBe(1);
  expect(reloaded.getState().players.map((player) => player.playerId)).toEqual(["qa-a1", "qa-a2"]);
  expect(reloaded.getState().players[0].isOnPitch).toBe(false);
  expect(reloaded.getState().players[1].isOnPitch).toBe(true);

  const { club, match, save } = setupSave();
  match.getState().substitutePlayer("qa-a1", "qa-a2");
  club.setState({ players: club.getState().players.filter((player) => player.id !== "qa-a1") });
  match.getState().openMatch("qa-club-a", "qa-team-a", remaining);
  expect(save()).toBe(false);
});

test("a fresh store restores clock, opponent and substituted lineup paused", () => {
  const original = matchModule.createMatchStore();
  original.getState().openMatch("qa-club-a", "qa-team-a", squad);
  original.getState().setOpponent("QA Opponent");
  original.getState().startMatchClock();
  advance(original);
  original.getState().substitutePlayer("qa-a1", "qa-a2");
  advance(original);
  const reloaded = matchModule.createMatchStore();
  reloaded.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(reloaded.getState().matchId).toBe(original.getState().matchId);
  expect(reloaded.getState().matchTimeSeconds).toBe(2);
  expect(reloaded.getState().opponent).toBe("QA Opponent");
  expect(reloaded.getState().players).toEqual(original.getState().players);
  expect(reloaded.getState().isClockRunning).toBe(false);
  expect(reloaded.getState().recovered).toBe(true);
  expect(matchModule.matchStorageKey("a.b", "c")).not.toBe(matchModule.matchStorageKey("a", "b.c"));
});

test("Reset creates a new identity only for the selected match", () => {
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  const oldId = store.getState().matchId;
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(store.getState().matchId).toBe(oldId);
  store.getState().setOpponent("QA Opponent");
  store.getState().setFormation("4-3-3");
  store.getState().resetMatch();
  expect(store.getState().matchId).not.toBe(oldId);
  expect(store.getState().opponent).toBe("");
  expect(store.getState().formation).toBe("4-3-3");
  expect(store.getState().matchTimeSeconds).toBe(0);
});

test("invalid saved match state cannot contaminate another team", () => {
  const key = matchModule.matchStorageKey("qa-club-a", "qa-team-a");
  cache.set(key, JSON.stringify({ version: 1, clubId: "qa-club-b", teamId: "qa-team-a", matchId: "foreign", opponent: "QA", matchTimeSeconds: 60, players: beta }));
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(store.getState().matchId).not.toBe("foreign");
  expect(store.getState().players.map((p) => p.playerId)).toEqual(["qa-a1", "qa-a2"]);
  expect(store.getState().storageWarning).toContain("could not be recovered");
});

test("recovery whitelists persisted data rather than overwriting store actions", () => {
  const key = matchModule.matchStorageKey("qa-club-a", "qa-team-a");
  cache.set(key, JSON.stringify({ version: 1, clubId: "qa-club-a", teamId: "qa-team-a", matchId: "qa-stored",
    opponent: "QA Opponent", matchTimeSeconds: 0, players: squad.map((player) => ({ ...player, minutesPlayed: 0 })), openMatch: "invalid", resetMatch: null }));
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(typeof store.getState().openMatch).toBe("function");
  expect(typeof store.getState().resetMatch).toBe("function");
  expect(store.getState().matchId).toBe("qa-stored");
});

test("unavailable storage retains scoped matches in memory and reports the limit", () => {
  unavailable = true;
  const store = matchModule.createMatchStore();
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  const id = store.getState().matchId;
  store.getState().setOpponent("QA In Memory");
  store.getState().startMatchClock();
  advance(store);
  store.getState().openMatch("qa-club-a", "qa-team-b", beta);
  store.getState().openMatch("qa-club-a", "qa-team-a", squad);
  expect(store.getState().matchId).toBe(id);
  expect(store.getState().matchTimeSeconds).toBe(1);
  expect(store.getState().opponent).toBe("QA In Memory");
  expect(store.getState().isClockRunning).toBe(false);
  expect(store.getState().storageWarning).toContain("unavailable");
});

test("saving retries update one match and one attendance row per player", () => {
  const { club, match, save } = setupSave();
  const id = match.getState().matchId;
  match.getState().startMatchClock();
  for (let i = 0; i < 60; i++) advance(match);
  expect(save()).toBe(true);
  expect(save()).toBe(true);
  expect(club.getState().matches).toHaveLength(2); // one untouched legacy record + this match
  expect(club.getState().attendance).toHaveLength(2);
  for (let i = 0; i < 60; i++) advance(match);
  expect(save()).toBe(true);
  expect(club.getState().matches.find((row) => row.id === id)?.minutes[0].minutesPlayed).toBeCloseTo(2);
  expect(club.getState().attendance).toHaveLength(2);
  match.getState().resetMatch(squad);
  match.getState().setOpponent("QA Next Opponent");
  expect(save()).toBe(true);
  expect(club.getState().matches).toHaveLength(3);
  expect(club.getState().attendance).toHaveLength(4);
});

test("save rejects foreign scope, duplicate players and altered minutes", () => {
  const { club, match } = setupSave();
  const current = match.getState();
  const rows = current.players.map(({ playerId, minutesPlayed }) => ({ playerId, minutesPlayed }));
  expect(club.getState().saveMatch(current.matchId, "qa-club-b", current.teamId, "QA", rows)).toBe(false);
  expect(club.getState().saveMatch(current.matchId, current.clubId, "qa-team-b", "QA", rows)).toBe(false);
  expect(club.getState().saveMatch(current.matchId, current.clubId, current.teamId, "QA", [rows[0], rows[0]])).toBe(false);
  expect(club.getState().saveMatch(current.matchId, current.clubId, current.teamId, "QA", [{ ...rows[0], minutesPlayed: 99 }, rows[1]])).toBe(false);
  club.persist.setOptions({ name: "bnfc-club-qa-club-b" });
  expect(club.getState().saveMatch(current.matchId, current.clubId, current.teamId, "QA", rows)).toBe(false);
  expect(club.getState().matches).toHaveLength(1);
  expect(club.getState().attendance).toHaveLength(0);
});
