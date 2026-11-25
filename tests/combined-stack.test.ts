import { expect, test } from "@playwright/test";
import { createJSONStorage } from "zustand/middleware";
import type { MatchExtra } from "../src/lib/club/seed";
import type { SquadEntry } from "../src/stores/match-store";

class MemoryStorage implements Storage {
  private rows = new Map<string, string>();
  get length() { return this.rows.size; }
  clear() { this.rows.clear(); }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  removeItem(key: string) { this.rows.delete(key); }
  setItem(key: string, value: string) { this.rows.set(key, String(value)); }
}
const storage = new MemoryStorage();
let matchModule: typeof import("../src/stores/match-store");
let clubModule: typeof import("../src/stores/club-store");
let scopeModule: typeof import("../src/lib/sync/team-scope");
let syncModule: typeof import("../src/lib/sync/engine");
const NativeDate = Date;
const originalNow = Date.now;
const originals = new Map<string, PropertyDescriptor | undefined>();
const clubId = "qa-combined-club", teamId = "qa-combined-team";
const squad: SquadEntry[] = [
  { playerId: "qa-rich-starter", name: "QA Rich Starter", squadNumber: 1, position: "GK", isOnPitch: true },
  { playerId: "qa-rich-reserve", name: "QA Rich Reserve", squadNumber: 9, position: "ST", isOnPitch: false },
];

test.beforeAll(async () => {
  for (const key of ["localStorage", "window", "fetch"]) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  // Real modules, synthetic storage, no mounted sync provider or cloud client.
  // Fail closed if a future refactor unexpectedly attempts a network request.
  const noNetwork = async () => { throw new Error("Combined local contract tests prohibit network requests"); };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, fetch: noNetwork } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: noNetwork });
  matchModule = await import("../src/stores/match-store");
  clubModule = await import("../src/stores/club-store");
  scopeModule = await import("../src/lib/sync/team-scope");
  syncModule = await import("../src/lib/sync/engine");
});

test.beforeEach(() => {
  storage.clear();
  matchModule.useMatchStore.getState().clearDeviceState();
  clubModule.useClubStore.persist.setOptions({ name: `bnfc-club-${clubId}`,
    storage: createJSONStorage(() => storage) });
  scopeModule.useTeamScope.setState({ clubId: null, isAdmin: false, teams: [], players: [], map: {} });
  syncModule.useSyncState.setState({ clubId: null, settings: { enabled: false, wifiOnly: false }, attention: [], pending: 0 });
});

test.afterEach(() => { globalThis.Date = NativeDate; Date.now = originalNow; });
test.afterAll(() => {
  globalThis.Date = NativeDate;
  Date.now = originalNow;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function seedClub() {
  const players = squad.map((player) => ({ id: player.playerId, name: player.name, firstName: "QA Rich",
    surname: player.playerId.endsWith("starter") ? "Starter" : "Reserve", teamId, squadNumber: player.squadNumber,
    position: player.position, regNumber: "", idNumber: "", mobile: "", correspondence: [], homework: "",
    seasonFee: 0, sponsoredAmount: 0, feeDueDate: "", payments: [], paymentPlan: null, promise: null,
    guardianName: "", guardianEmail: "", accessPin: "" }));
  clubModule.useClubStore.setState({ hydrated: true, clubKind: "custom", coachTeamId: teamId,
    ageGroups: [{ id: "qa-u12", name: "U12", displayOrder: 12, teams: [{ id: teamId, name: "Prem", division: "Prem" }] }],
    players, matches: [], attendance: [] });
  const match = matchModule.useMatchStore;
  match.getState().openMatch(clubId, teamId, squad);
  match.getState().setOpponent("QA Rich Opponent");
  return { club: clubModule.useClubStore, match };
}

test("rich clock catches background elapsed without interval ticks and timestamps goals and substitutions", () => {
  let now = 1_000_000;
  Date.now = () => now;
  const match = matchModule.createMatchStore();
  match.getState().openMatch(clubId, teamId, squad);
  match.getState().startMatchClock();
  now += 90_000; // No tick callback ran while the page was backgrounded.
  expect(matchModule.elapsedMs(match.getState())).toBe(90_000);
  match.getState().addGoal("for", 1);
  match.getState().substitutePlayer(squad[0].playerId, squad[1].playerId);
  now += 30_000;
  match.getState().tickSecond();
  match.getState().addGoal("against", 1);
  match.getState().pauseMatchClock();
  expect(match.getState().matchTimeSeconds).toBe(120);
  expect(match.getState().ourScore).toBe(1);
  expect(match.getState().theirScore).toBe(1);
  expect(match.getState().players[0].minutesPlayed).toBeCloseTo(1.5);
  expect(match.getState().players[1].minutesPlayed).toBeCloseTo(0.5);
  expect(match.getState().events).toEqual([
    { kind: "GOAL_FOR", atMs: 90_000 },
    { kind: "SUB", atMs: 90_000, offId: squad[0].playerId, onId: squad[1].playerId },
    { kind: "GOAL_AGAINST", atMs: 120_000 },
  ]);
  now += 300_000;
  match.getState().tickSecond();
  expect(match.getState().matchTimeSeconds).toBe(120);
});

test("scoped paused recovery retains rich scores, events, formation and layout", () => {
  let now = 2_000_000;
  Date.now = () => now;
  const original = matchModule.createMatchStore();
  original.getState().openMatch(clubId, teamId, squad);
  original.getState().setOpponent("QA Recovery Opponent");
  original.getState().setFormation("4-3-3");
  const layout = [{ playerId: squad[0].playerId, x: 50, y: 85 }];
  original.getState().setLayout(layout);
  original.getState().startMatchClock();
  now += 60_000;
  original.getState().substitutePlayer(squad[0].playerId, squad[1].playerId);
  now += 60_000;
  original.getState().addGoal("for", 1);
  original.getState().pauseMatchClock();
  const expected = original.getState();
  now += 600_000; // Closed/paused time must not become playing minutes.
  const recovered = matchModule.createMatchStore();
  recovered.getState().openMatch(clubId, teamId, squad);
  expect(recovered.getState()).toMatchObject({ matchId: expected.matchId, clubId, teamId,
    opponent: "QA Recovery Opponent", formation: "4-3-3", layout, matchTimeSeconds: 120,
    ourScore: 1, theirScore: 0, isClockRunning: false, recovered: true });
  expect(recovered.getState().events).toEqual(expected.events);
  expect(recovered.getState().players).toEqual(expected.players);
  recovered.getState().openMatch("qa-other-club", teamId, squad);
  expect(recovered.getState().matchId).not.toBe(expected.matchId);
  expect(recovered.getState().events).toEqual([]);
  expect(recovered.getState().ourScore).toBe(0);
  recovered.getState().openMatch(clubId, teamId, squad);
  expect(recovered.getState().matchId).toBe(expected.matchId);
  expect(recovered.getState().events).toEqual(expected.events);
});

test("rich MatchExtra survives idempotent local saving and authorized cloud payload mapping", () => {
  let now = 3_000_000;
  class ClockDate extends NativeDate {
    constructor(value?: string | number) { super(value === undefined ? now : value); }
    static now() { return now; }
  }
  // Saving uses new Date().toISOString(), so advance both Date APIs deterministically.
  globalThis.Date = ClockDate as unknown as DateConstructor;
  const { club, match } = seedClub();
  match.getState().startMatchClock();
  now += 60_000;
  match.getState().substitutePlayer(squad[0].playerId, squad[1].playerId);
  now += 60_000;
  match.getState().addGoal("for", 1);
  match.getState().addGoal("against", 1);
  match.getState().setFormation("4-3-3");
  match.getState().setLayout([{ playerId: squad[1].playerId, x: 30, y: 40 }]);
  match.getState().pauseMatchClock();
  const active = match.getState();
  const extra: MatchExtra = { formation: active.formation, durationSeconds: active.matchTimeSeconds,
    ourScore: active.ourScore, theirScore: active.theirScore, layout: active.layout, teamLabel: "QA U12 Prem",
    events: active.events.map((event) => ({ ...event })),
    players: active.players.map(({ playerId, name, squadNumber, position, startedOnPitch }) =>
      ({ playerId, name, squadNumber, position, startedOnPitch })),
  };
  const minutes = active.players.map(({ playerId, minutesPlayed }) => ({ playerId, minutesPlayed }));
  expect(club.getState().saveMatch(active.matchId, clubId, teamId, active.opponent, minutes, extra)).toBe(true);
  expect(club.getState().saveMatch(active.matchId, clubId, teamId, active.opponent, minutes, extra)).toBe(true);
  expect(club.getState().matches).toHaveLength(1);
  expect(club.getState().attendance).toHaveLength(2);
  const saved = club.getState().matches[0];
  expect(saved).toMatchObject(extra);
  expect(saved.updatedAt).toBeTruthy();
  scopeModule.useTeamScope.setState({ clubId: "qa-cloud-club", isAdmin: false,
    teams: [{ id: "qa-cloud-team", name: "QA Cloud Prem" }], map: { [teamId]: "qa-cloud-team" },
    players: squad.map((player, i) => ({ id: `qa-cloud-player-${i}`, teamId: "qa-cloud-team", name: player.name })),
  });
  expect(scopeModule.resolveMatchTeam(saved)).toBe("qa-cloud-team");
  const payload = syncModule.matchRow("qa-cloud-club", saved); // Pure mapping only; never enqueue/sync/upload.
  expect(payload).toMatchObject({ club_id: "qa-cloud-club", local_id: active.matchId, team_id: "qa-cloud-team",
    player_ids: ["qa-cloud-player-0", "qa-cloud-player-1"], duration_seconds: 120, our_score: 1, their_score: 1,
    formation: "4-3-3", team_label: "QA U12 Prem", detail: { minutes, players: extra.players, events: extra.events, layout: extra.layout, teamId } });
  now += 1_000;
  club.getState().assignMatchTeam(active.matchId, "qa-cloud-team");
  expect(club.getState().matches[0].updatedAt).not.toBe(saved.updatedAt);
  expect(club.getState().matches[0]).toMatchObject({ ...extra, cloudTeamId: "qa-cloud-team" });
  expect(club.getState().saveMatch(active.matchId, clubId, teamId, active.opponent, minutes, extra)).toBe(true);
  expect(club.getState().matches[0].cloudTeamId).toBe("qa-cloud-team");
  expect(club.getState().matches).toHaveLength(1);
});

test("cloud squad refresh preserves existing registration, finance, correspondence and private local fields", () => {
  const { club } = seedClub();
  const existing = { ...club.getState().players[0], id: "cloud-qa-cloud-player", teamId: "cloud-qa-cloud-team",
    name: "QA Earlier Name", regNumber: "REG-QA-0042", idNumber: "QA synthetic ID", mobile: "0000000",
    seasonFee: 1000, sponsoredAmount: 200, payments: [{ id: "qa-payment", amount: 300, date: "2026-11-01" }],
    homework: "QA local homework", accessPin: "1234", guardianName: "QA Guardian", guardianEmail: "",
    correspondence: [{ id: "qa-note", channel: "Note" as const, summary: "QA local note", date: "2026-11-01" }],
  };
  club.setState({ players: [existing] });
  scopeModule.useTeamScope.setState({ clubId: "qa-cloud-club", isAdmin: false, map: {},
    teams: [{ id: "qa-cloud-team", name: "QA Cloud Prem", ageGroup: "U12" }],
    players: [{ id: "qa-cloud-player", teamId: "qa-cloud-team", name: "QA Updated Name", squadNumber: 5, position: "CM" },
      { id: "qa-new-player", teamId: "qa-cloud-team", name: "QA New Player", squadNumber: 7, position: "ST" }],
  });
  scopeModule.importClubSquads(); // Imports supplied local scope state; does not load cloud scope.
  const updated = club.getState().players.find((player) => player.id === existing.id)!;
  expect(updated).toMatchObject({ name: "QA Updated Name", squadNumber: 5, position: "CM",
    regNumber: existing.regNumber, idNumber: existing.idNumber, mobile: existing.mobile,
    seasonFee: 1000, sponsoredAmount: 200, payments: existing.payments, correspondence: existing.correspondence,
    homework: existing.homework, accessPin: existing.accessPin, guardianName: existing.guardianName });
  const added = club.getState().players.find((player) => player.id === "cloud-qa-new-player")!;
  expect(added).toMatchObject({ name: "QA New Player", teamId: "cloud-qa-cloud-team", payments: [],
    correspondence: [], regNumber: "", seasonFee: 0, sponsoredAmount: 0, paymentPlan: null, promise: null, accessPin: "" });
  expect(scopeModule.cloudTeamFor("cloud-qa-cloud-team")).toBe("qa-cloud-team");
  scopeModule.useTeamScope.setState({ players: scopeModule.useTeamScope.getState().players.map((player) =>
    player.id === "qa-cloud-player" ? { ...player, position: "DEF" } : player) });
  scopeModule.importClubSquads();
  const positionOnly = club.getState().players.find((player) => player.id === existing.id)!;
  expect(positionOnly).toMatchObject({ name: "QA Updated Name", squadNumber: 5, position: "DEF",
    regNumber: existing.regNumber, seasonFee: 1000, sponsoredAmount: 200, payments: existing.payments,
    correspondence: existing.correspondence, homework: existing.homework, accessPin: existing.accessPin });
});

test("rich recovery ignores persisted action aliases and rejects malformed or unscoped records", () => {
  let now = 4_000_000;
  Date.now = () => now;
  const original = matchModule.createMatchStore();
  original.getState().openMatch(clubId, teamId, squad);
  original.getState().startMatchClock();
  now += 5_000;
  original.getState().pauseMatchClock();
  const key = matchModule.matchStorageKey(clubId, teamId);
  const raw = JSON.parse(storage.getItem(key)!);
  storage.setItem(key, JSON.stringify({ ...raw, loadSquad: "QA bad alias", resetMatch: "QA bad alias", clearDeviceState: "QA bad alias" }));
  const good = matchModule.createMatchStore();
  good.getState().openMatch(clubId, teamId, squad);
  expect(good.getState().matchId).toBe(raw.matchId);
  expect(typeof good.getState().loadSquad).toBe("function");
  expect(typeof good.getState().resetMatch).toBe("function");
  expect(typeof good.getState().clearDeviceState).toBe("function");
  storage.setItem(key, JSON.stringify({ ...raw, ourScore: -1 }));
  const invalid = matchModule.createMatchStore();
  invalid.getState().openMatch(clubId, teamId, squad);
  expect(invalid.getState().matchId).not.toBe(raw.matchId);
  expect(invalid.getState().ourScore).toBe(0);
  expect(invalid.getState().storageWarning).toContain("could not be recovered");
  storage.removeItem(key);
  storage.setItem("football-live-match", JSON.stringify({ version: 1, state: raw }));
  const unattributed = matchModule.createMatchStore();
  unattributed.getState().openMatch(clubId, teamId, squad);
  expect(unattributed.getState().matchId).not.toBe(raw.matchId);
  expect(unattributed.getState().matchTimeSeconds).toBe(0);
});

test("cloud sign-out storage cleanup removes copied coaching data and match memory cannot revive it", () => {
  let now = 5_000_000;
  Date.now = () => now;
  const { match } = seedClub();
  match.getState().startMatchClock();
  now += 60_000;
  match.getState().tickSecond();
  const oldId = match.getState().matchId;
  match.getState().openMatch(clubId, "qa-another-team", squad);
  const copiedKeys = ["bnfc-club-cloud-qa-cloud", "football-live-match", "football-team-scope-qa-cloud",
    "cs.football.match.v1.qa-cloud.qa-team", "cs.football.roster.v1.qa-install.club-qa-cloud.qa-team",
    "cs.football.active-roster.v1", "cs.lite.roster.v1", "cs.lite.matches.v1.qa-install.qa-team",
    "Clubstride Mobile_history", "Clubstride Mobile_teams", "Clubstride Mobile_squad",
    "cs.club.device-roster.v1", "cs.lite.connection.v1.qa-user.qa-install.qa-team", "cs.club.active-team.v1.qa-user"];
  for (const key of copiedKeys) storage.setItem(key, JSON.stringify({ marker: "QA copied coaching data" }));
  storage.setItem("qa-unrelated-preference", "keep");
  const localProfile = { id: clubId, name: "QA Local Registration",
    banking: { accountHolder: "QA Fictional Club", accountNumber: "00000000" } };
  storage.setItem("bnfc-clubs", JSON.stringify({
    clubs: [localProfile, { id: "cloud-qa-cloud", name: "QA Cloud Registration" }], activeId: "cloud-qa-cloud",
  }));
  expect(syncModule.clearCoachingStorage(storage)).toBe(true); // Pure key cleanup, not clearDeviceData/IndexedDB/network.
  for (const key of copiedKeys) expect(storage.getItem(key)).toBeNull();
  expect(storage.getItem("qa-unrelated-preference")).toBe("keep");
  expect(JSON.parse(storage.getItem("bnfc-clubs")!)).toEqual({ clubs: [localProfile], activeId: null });
  const keysBeforeMemoryClear = Array.from({ length: storage.length }, (_, index) => storage.key(index)).sort();
  match.getState().clearDeviceState();
  expect(match.getState()).toMatchObject({ matchId: "", players: [], events: [], ourScore: 0, theirScore: 0 });
  expect(Array.from({ length: storage.length }, (_, index) => storage.key(index)).sort()).toEqual(keysBeforeMemoryClear);
  match.getState().openMatch(clubId, teamId, squad);
  expect(match.getState().matchId).not.toBe(oldId);
  expect(match.getState().matchTimeSeconds).toBe(0);
  expect(match.getState().players.every((player) => player.minutesPlayed === 0)).toBe(true);
});
