import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("../src/lib/club/sync-lite.ts", import.meta.url), "utf8"))
  .replace(/^export /gm, "");
const installation = "11111111-1111-4111-8111-111111111111";
const activeKey = "cs.lite.roster.v1";
const bindingKey = "cs.football.active-roster.v1";
const legacyKey = "Clubstride Mobile_teams";
const squadKey = "Clubstride Mobile_squad";
const a = { id: "qa-a", name: "QA Alpha" };
const b = { id: "qa-b", name: "QA Beta" };
const c = { id: "qa-c", name: "QA Other" };
const keeper = { id: "qa-a1", name: "QA Alpha Keeper", squadNumber: 1, position: "GK" };
const forward = { id: "qa-b1", name: "QA Beta Forward", squadNumber: 9, position: "ST" };
const refresh = { activate: false };

function harness() {
  const cache = new Map([
    ["cs.lite.installation.v1", installation],
    ["bnfc-clubs", JSON.stringify({ activeId: "qa-club" })],
  ]);
  const events = [], messages = [], warnings = [];
  const context = vm.createContext({
    localStorage: { getItem: (key) => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) },
    window: { dispatchEvent: (event) => events.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
    BroadcastChannel: class { postMessage(message) { messages.push(message); } close() {} },
    console: { warn: (...args) => warnings.push(args) },
  });
  vm.runInContext(source, context);
  const read = (key) => JSON.parse(cache.get(key) ?? "null");
  const teamCache = (team, club = "qa-club", install = installation) =>
    read(`cs.football.roster.v1.${install}.club-${encodeURIComponent(club)}.${team.id}`);
  const names = (snapshot) => snapshot.players.map((p) => p.name);
  const clearNotifications = () => { events.length = 0; messages.length = 0; };
  return { cache, context, events, messages, warnings, read, teamCache, names, clearNotifications,
    sync: context.syncTeamToLite };
}

function transfer(h) {
  h.sync(b, [keeper, forward], refresh);
  h.sync(a, [], refresh);
}

test("Alpha to active Beta refreshes both caches but publishes only Beta", () => {
  const h = harness();
  h.sync(a, [keeper]);
  h.sync(b, [forward]);
  h.cache.set("Clubstride Mobile_current_team_id", b.id);
  h.clearNotifications();
  transfer(h);
  assert.equal(h.read(activeKey).teamId, b.id);
  assert.deepEqual(h.names(h.read(activeKey)), [keeper.name, forward.name]);
  assert.deepEqual(h.read(squadKey).map((p) => p.id), [keeper.id, forward.id]);
  assert.deepEqual(h.names(h.teamCache(a)), []);
  assert.deepEqual(h.names(h.teamCache(b)), [keeper.name, forward.name]);
  assert.deepEqual(h.read(legacyKey).find((t) => t.id === a.id).squad, []);
  assert.equal(h.read(legacyKey).find((t) => t.id === b.id).squad.length, 2);
  assert.equal(h.cache.get("Clubstride Mobile_current_team_id"), b.id);
  assert.deepEqual(h.events, ["cs-lite-roster-change"]);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].roster.teamId, b.id);
});

test("transfer out of active Alpha leaves Alpha selected with an empty squad", () => {
  const h = harness();
  h.sync(a, [keeper]);
  h.clearNotifications();
  transfer(h);
  assert.equal(h.read(activeKey).teamId, a.id);
  assert.deepEqual(h.names(h.read(activeKey)), []);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].roster.teamId, a.id);
  assert.equal(h.teamCache(b).players.length, 2);
});

test("an unrelated active squad and its direct cache are not replaced", () => {
  const h = harness();
  h.sync(c, [forward]);
  const before = h.cache.get(activeKey), directBefore = h.cache.get(squadKey);
  h.clearNotifications();
  transfer(h);
  assert.equal(h.cache.get(activeKey), before);
  assert.equal(h.cache.get(squadKey), directBefore);
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.messages, []);
  assert.equal(h.teamCache(a).players.length, 0);
  assert.equal(h.teamCache(b).players.length, 2);
});

test("owned cloud canonical and legacy rows retain their ownership and players", () => {
  const h = harness();
  h.sync(b, [forward]);
  const owned = { ...h.read(activeKey), ownerId: "22222222-2222-4222-8222-222222222222",
    cloudTeamId: "33333333-3333-4333-8333-333333333333", readOnly: true };
  const legacy = h.read(legacyKey).map((row) => ({ ...row, ownerId: owned.ownerId, cloudTeamId: owned.cloudTeamId, readOnly: true }));
  h.cache.set(activeKey, JSON.stringify(owned));
  h.cache.set(legacyKey, JSON.stringify(legacy));
  const before = h.cache.get(activeKey), legacyBefore = h.cache.get(legacyKey);
  h.clearNotifications();
  h.sync(b, [keeper, forward], refresh);
  assert.equal(h.cache.get(activeKey), before);
  assert.equal(h.cache.get(legacyKey), legacyBefore);
  assert.equal(h.read(squadKey).length, 1);
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.messages, []);
});

test("a same-id team in another club gets a separate cache and cannot overwrite current club", () => {
  const h = harness();
  h.sync(b, [forward]);
  const before = h.cache.get(activeKey), legacyBefore = h.cache.get(legacyKey);
  h.cache.set("bnfc-clubs", JSON.stringify({ activeId: "qa-other-club" }));
  h.clearNotifications();
  h.sync(b, [keeper], refresh);
  assert.equal(h.cache.get(activeKey), before);
  assert.equal(h.cache.get(legacyKey), legacyBefore);
  assert.deepEqual(h.names(h.teamCache(b)), [forward.name]);
  assert.deepEqual(h.names(h.teamCache(b, "qa-other-club")), [keeper.name]);
  assert.deepEqual(h.events, []);
});

test("refresh cannot replace an active roster from another installation", () => {
  const h = harness();
  h.sync(b, [forward]);
  const before = h.cache.get(activeKey), legacyBefore = h.cache.get(legacyKey);
  const other = "44444444-4444-4444-8444-444444444444";
  h.cache.set("cs.lite.installation.v1", other);
  h.clearNotifications();
  h.sync(b, [keeper], refresh);
  assert.equal(h.cache.get(activeKey), before);
  assert.equal(h.cache.get(legacyKey), legacyBefore);
  assert.deepEqual(h.names(h.teamCache(b, "qa-club", other)), [keeper.name]);
  assert.deepEqual(h.events, []);
});

test("automatic refresh with no active squad caches only, then explicit launch selects it", () => {
  const h = harness();
  assert.equal(h.sync(b, [forward], refresh), true);
  assert.equal(h.cache.has(activeKey), false);
  assert.equal(h.cache.has(squadKey), false);
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.names(h.teamCache(b)), [forward.name]);
  assert.equal(h.sync(b, [forward]), true);
  assert.equal(h.read(activeKey).teamId, b.id);
  assert.equal(h.read(bindingKey).clubId, "qa-club");
});

test("legacy canonical without known club binding is retained until an explicit launch", () => {
  const h = harness();
  h.sync(b, [forward]);
  h.cache.delete(bindingKey);
  const before = h.cache.get(activeKey);
  h.clearNotifications();
  h.sync(b, [], refresh);
  assert.equal(h.cache.get(activeKey), before);
  assert.deepEqual(h.events, []);
  h.sync(b, []);
  assert.deepEqual(h.names(h.read(activeKey)), []);
});

test("removing a player to unassigned refreshes the active old team without changing selection", () => {
  const h = harness();
  h.sync(a, [keeper]);
  h.sync(a, [], refresh);
  assert.equal(h.read(activeKey).teamId, a.id);
  assert.deepEqual(h.names(h.read(activeKey)), []);
});

test("malformed canonical JSON is retained on refresh and recovered by explicit launch", () => {
  const h = harness();
  h.cache.set(activeKey, "invalid-json");
  h.cache.set(legacyKey, "invalid-legacy-json");
  assert.equal(h.sync(b, [forward], refresh), true);
  assert.equal(h.cache.get(activeKey), "invalid-json");
  assert.equal(h.cache.get(legacyKey), "invalid-legacy-json");
  assert.equal(h.sync(b, [forward]), true);
  assert.equal(h.read(activeKey).teamId, b.id);
  assert.equal(h.cache.get(legacyKey), "invalid-legacy-json");
});

test("storage read/write failures return false without dispatching a misleading update", () => {
  for (const method of ["getItem", "setItem"]) {
    const h = harness();
    h.context.localStorage[method] = () => { throw new Error("QA unavailable storage"); };
    assert.equal(h.sync(b, [forward]), false);
    assert.equal(h.warnings.length, 1);
    assert.deepEqual(h.events, []);
  }
});

test("first explicit handoff persists the installation used by later background refresh", () => {
  const h = harness();
  h.cache.delete("cs.lite.installation.v1");
  h.sync(b, [forward]);
  const id = h.read(activeKey).installationId;
  assert.equal(h.cache.get("cs.lite.installation.v1"), id);
  h.sync(b, [keeper, forward], refresh);
  assert.equal(h.read(activeKey).players.length, 2);
  assert.equal(h.read(activeKey).installationId, id);
});

test("local snapshots do not invent authenticated ownership metadata", () => {
  const h = harness();
  h.sync(b, [forward]);
  for (const field of ["ownerId", "cloudTeamId", "readOnly"]) {
    assert.equal(Object.hasOwn(h.read(activeKey), field), false);
    assert.equal(Object.hasOwn(h.teamCache(b), field), false);
  }
});
