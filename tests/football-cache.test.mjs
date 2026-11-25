import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const lite = readFileSync(new URL("../public/lite/index.html", import.meta.url), "utf8");
const producer = stripTypeScriptTypes(readFileSync(new URL("../src/lib/club/sync-lite.ts", import.meta.url), "utf8"))
  .replace(/^export /gm, "");
function method(name) {
  const start = lite.indexOf(`      ${name}(`);
  assert.notEqual(start, -1, `Missing actual Lite method ${name}`);
  return lite.slice(start, lite.indexOf("\n      },", start) + 9);
}
const methods = ["validateSharedRoster", "sharedRosterContent", "currentSharedRosterContent",
  "footballTeamSnapshot", "refreshFootballTeamCaches", "bindFootballTeam", "syncActiveTeamSquad",
  "setSharedTeamMetadata", "loadTeam", "applySharedRoster", "saveStorage", "publishLiteRoster"];
const install = "11111111-1111-4111-8111-111111111111";
const club = "qa-club";
const a = { id: "qa-a", name: "QA Alpha" }, b = { id: "qa-b", name: "QA Beta" };
const keeper = { id: "qa-p1", name: "QA Alpha Keeper", squadNumber: 1, position: "GK" };
const second = { id: "qa-p2", name: "QA Alpha Two", squadNumber: 2, position: "CM" };
const beta = { id: "qa-b1", name: "QA Beta One", squadNumber: 9, position: "ST" };
const extra = { id: "qa-local", name: "QA Lite Only", number: 8, position: "CM", available: true };
const refresh = { activate: false };
const plain = (value) => JSON.parse(JSON.stringify(value));
const names = (rows) => Array.from(rows, (row) => row.name);

function harness() {
  const storage = new Map([
    ["cs.lite.installation.v1", install], ["bnfc-clubs", JSON.stringify({ activeId: club })],
  ]);
  const warnings = [];
  // Fixed time proves per-team producer revisions advance even for same-millisecond edits.
  class FixedDate extends Date {
    constructor(value) { super(value === undefined ? "2026-11-25T10:00:00.000Z" : value); }
    static now() { return Date.parse("2026-11-25T10:00:00.000Z"); }
  }
  const state = { teams: [], currentTeamId: null, currentTeamName: "", squad: [],
    match: { format: "7", formation: "2-3-1", fieldPositions: {}, availability: {}, starters: [], bench: [] },
    clock: { seconds: 0, period: "1st Half", running: false }, events: [], playerTimers: {},
    kitColor: "#22D3EE", themeStyle: "glass", theme: "night" };
  const context = vm.createContext({ AppState: state, Date: FixedDate,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    window: { dispatchEvent() {} }, CustomEvent: class {}, BroadcastChannel: undefined,
    console: { warn() {}, error() {} }, clearInterval() {},
    document: { getElementById: () => ({ value: "", innerText: "" }) },
  });
  vm.runInContext(producer, context);
  const app = vm.runInContext(`({${methods.map(method).join("")}})`, context);
  for (const name of ["setHeaderTeamBadge", "applyTheme", "clearActiveTeamMatch", "setupIcons",
    "applyFormatDefaults", "restoreSelectedTeamMatch", "renderAll", "renderSavedTeamsList", "toast",
    "captureActiveTeamMatch", "updateRosterReadOnlyControls", "populateFormationSelect"]) app[name] = () => {};
  app.reportStorageFailure = (source, message) => { if (message) warnings.push([source, message]); };
  app.getLiteInstallationId = () => install;
  app.rosterMutationAllowed = () => !state.readOnly;
  app.publishLiteMatches = () => true;
  const read = (key) => JSON.parse(storage.get(key) ?? "null");
  const key = (team, clubId = club, installationId = install) =>
    `cs.football.roster.v1.${installationId}.club-${encodeURIComponent(clubId)}.${team.id}`;
  const sync = context.syncTeamToLite;
  sync(a, [keeper, second]);
  state.teams = read("Clubstride Mobile_teams");
  state.currentTeamId = a.id;
  state.currentTeamName = a.name;
  state.sharedInstallationId = install;
  state.squad = read("cs.lite.roster.v1").players;
  app.refreshFootballTeamCaches();
  return { storage, context, state, app, warnings, read, key, sync };
}

function switchToBeta(h) {
  h.sync(b, [beta]);
  assert.equal(h.app.applySharedRoster(true), true);
  assert.equal(h.state.currentTeamId, b.id);
}
function transferToBeta(h) {
  h.sync(b, [keeper, beta], refresh);
  h.app.applySharedRoster();
  h.sync(a, [second], refresh);
}

test("whole-list save reconciles inactive Alpha without changing active Beta", () => {
  const h = harness();
  switchToBeta(h);
  transferToBeta(h);
  const selection = h.storage.get("cs.football.active-roster.v1");
  h.app.saveStorage();
  const saved = h.read("Clubstride Mobile_teams");
  assert.deepEqual(names(saved.find((t) => t.id === a.id).squad), [second.name]);
  assert.equal(h.state.currentTeamId, b.id);
  assert.deepEqual(names(h.state.squad), [keeper.name, beta.name]);
  assert.equal(h.storage.get("cs.football.active-roster.v1"), selection);
  assert.equal(h.read("cs.lite.roster.v1").teamId, b.id);
});

test("explicit saved Alpha load consumes refreshed players and rebinds subsequent admin refresh", () => {
  const h = harness();
  switchToBeta(h);
  transferToBeta(h);
  h.app.loadTeam(a.id);
  assert.equal(h.state.currentTeamId, a.id);
  assert.deepEqual(names(h.state.squad), [second.name]);
  assert.deepEqual(h.read("cs.football.active-roster.v1"), { clubId: club, installationId: install, teamId: a.id });
  assert.equal(h.read("cs.lite.roster.v1").teamId, a.id);
  h.sync(a, [], refresh);
  assert.equal(h.app.applySharedRoster(), true);
  assert.deepEqual(names(h.state.squad), []);
});

test("new incoming row adopts safe club metadata only from the matching bound legacy row", () => {
  const h = harness();
  switchToBeta(h);
  const row = h.state.teams.find((t) => t.id === b.id);
  assert.equal(row.footballClubId, club);
  assert.equal(row.sharedInstallationId, install);
  assert.equal(row.footballRosterRevision, h.read(h.key(b)).revision);
});

test("an already consumed Football cache does not erase subsequent Lite-only edits", () => {
  const h = harness();
  h.state.squad.push(extra);
  h.app.syncActiveTeamSquad(true);
  switchToBeta(h);
  h.app.saveStorage();
  assert.deepEqual(names(h.state.teams.find((t) => t.id === a.id).squad), [keeper.name, second.name, extra.name]);
  h.app.loadTeam(a.id);
  assert.deepEqual(names(h.state.squad), [keeper.name, second.name, extra.name]);
  // A genuinely new Football edit remains authoritative for its local roster.
  switchToBeta(h);
  h.sync(a, [second], refresh);
  h.app.loadTeam(a.id);
  assert.deepEqual(names(h.state.squad), [second.name]);
});

test("producer revisions increase for repeated edits at one fixed timestamp", () => {
  const h = harness();
  const before = h.read(h.key(a)).revision;
  h.sync(a, [second], refresh);
  const after = h.read(h.key(a)).revision;
  assert.ok(Date.parse(after) > Date.parse(before));
  assert.equal(Date.parse(after) - Date.parse(before), 1);
});

test("owned, read-only and manual unknown rows are retained without inferred scope", () => {
  const h = harness();
  switchToBeta(h);
  const alpha = h.state.teams.find((t) => t.id === a.id);
  for (const fields of [{ ownerId: "QA owner" }, { cloudTeamId: "22222222-2222-4222-8222-222222222222" }, { readOnly: true }, { readOnly: false }]) {
    const row = { ...plain(alpha), ...fields };
    h.state.teams = [row];
    const before = plain(row);
    h.sync(a, [], refresh);
    h.app.refreshFootballTeamCaches();
    assert.deepEqual(plain(row), before);
    assert.equal(h.app.bindFootballTeam(row), false);
  }
  const unknown = { id: "qa-manual", name: "QA Manual", squad: [extra] };
  h.state.teams = [unknown];
  h.app.refreshFootballTeamCaches();
  assert.deepEqual(plain(unknown), { id: "qa-manual", name: "QA Manual", squad: [extra] });
  assert.equal(h.app.bindFootballTeam(unknown), false);
});

test("foreign club/installation or mismatched cache identity cannot replace saved data", () => {
  const h = harness();
  switchToBeta(h);
  const alpha = h.state.teams.find((t) => t.id === a.id);
  const before = plain(alpha);
  const original = h.storage.get(h.key(a));
  for (const changed of [
    { ...JSON.parse(original), teamId: "qa-other" },
    { ...JSON.parse(original), installationId: "22222222-2222-4222-8222-222222222222" },
    { ...JSON.parse(original), ownerId: "QA owned cache" },
  ]) {
    h.storage.set(h.key(a), JSON.stringify(changed));
    h.app.refreshFootballTeamCaches();
    assert.deepEqual(plain(alpha), before);
  }
  h.storage.set(h.key(a), original);
  alpha.footballClubId = "qa-foreign-club";
  h.storage.set(h.key(a, "qa-foreign-club"), JSON.stringify({ ...JSON.parse(original), players: [] }));
  const foreignBefore = plain(alpha);
  h.app.refreshFootballTeamCaches();
  assert.deepEqual(plain(alpha), foreignBefore);
});

test("new unknown rows cannot adopt another team's or club's bound metadata", () => {
  const h = harness();
  switchToBeta(h);
  const row = { id: a.id, name: "QA Legacy Alpha", sharedInstallationId: install, squad: [extra] };
  h.state.teams = [row];
  const before = plain(row);
  h.app.refreshFootballTeamCaches();
  assert.deepEqual(plain(row), before); // binding is Beta, not the unknown Alpha row
  assert.equal(h.app.bindFootballTeam(row), false);
});

test("malformed/unavailable cache leaves good roster data and active selection intact", () => {
  for (const invalid of ["{bad", JSON.stringify({ version: 1 }), JSON.stringify({ ...harness().read("cs.lite.roster.v1"), players: [{ id: "bad" }] })]) {
    const h = harness();
    switchToBeta(h);
    h.storage.set(h.key(a), invalid);
    const before = plain(h.state);
    h.app.refreshFootballTeamCaches();
    assert.deepEqual(plain(h.state), before);
  }
  const h = harness();
  switchToBeta(h);
  const before = plain(h.state);
  h.context.localStorage.getItem = () => { throw new Error("QA denied storage"); };
  assert.doesNotThrow(() => h.app.refreshFootballTeamCaches());
  assert.deepEqual(plain(h.state), before);
});

test("read-only current squad cannot explicitly bind a local row", () => {
  const h = harness();
  h.state.readOnly = true;
  const before = h.storage.get("cs.football.active-roster.v1");
  assert.equal(h.app.bindFootballTeam(h.state.teams[0]), false);
  assert.equal(h.storage.get("cs.football.active-roster.v1"), before);
});

test("failed selection persistence warns and does not rewrite the binding", () => {
  const h = harness();
  switchToBeta(h);
  const row = h.state.teams.find((t) => t.id === a.id);
  const before = h.storage.get("cs.football.active-roster.v1");
  const set = h.context.localStorage.setItem;
  h.context.localStorage.setItem = (key, value) => {
    if (key === "cs.football.active-roster.v1") throw new Error("QA full storage");
    return set(key, value);
  };
  assert.equal(h.app.bindFootballTeam(row), false);
  assert.equal(h.storage.get("cs.football.active-roster.v1"), before);
  assert.equal(h.warnings.length, 1);
});
