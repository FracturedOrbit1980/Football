"use client";

import { create } from "zustand";

import { getCloud, errorText } from "@/lib/cloud/client";
import type { DrillBoard } from "@/lib/club/board";
import { clubLibrary } from "@/lib/club/library";
import type { ClubDrill, SavedMatch } from "@/lib/club/seed";
import { resolveMatchPlayers, resolveMatchTeam, useTeamScope } from "@/lib/sync/team-scope";
import { idbAll, idbClear, idbDelete, idbGet, idbPut, META, OUTBOX } from "@/lib/sync/idb";
import { useClubStore } from "@/stores/club-store";

/*
 * Offline-first sync for drills and match records.
 *
 * - Every local change is queued in IndexedDB (one entry per record; a newer edit
 *   replaces the queued one) and pushed when the device is online and sync is allowed.
 * - Conflicts: last write wins on updated_at. The device stamps updated_at when the
 *   record is edited; the database ignores an update older than the stored row, and a
 *   pull only overwrites a local record when the server copy is newer.
 * - Only club-created drills sync. The built-in library ships with the app.
 * - Matches carry a real club team id (see team-scope.ts). A match with no team that this
 *   user may write is HELD on the device until a team is chosen; a staff member can never
 *   upload an unassigned match. A record the server refuses (RLS or validation) is marked
 *   REJECTED with the reason instead of blocking the queue; network failures just retry.
 */

export type SyncTable = "club_drills" | "club_matches";
export type SyncStatus = "local" | "off" | "idle" | "syncing" | "offline" | "waiting-wifi" | "error";

interface OutboxItem {
  key: string;
  table: SyncTable;
  clubId: string;
  localId: string;
  row: Record<string, unknown>;
  /** held: waiting for a club team; rejected: refused by the server. Neither is retried automatically. */
  state?: "held" | "rejected";
  reason?: string;
}

export interface AttentionItem {
  key: string;
  table: SyncTable;
  localId: string;
  label: string;
  state: "held" | "rejected";
  reason: string;
}

interface MetaItem {
  key: string;
  value: string;
}

export interface SyncSettingsValue {
  enabled: boolean;
  wifiOnly: boolean;
}

const SETTINGS_KEY = "football-sync-settings";
const LIBRARY_IDS = new Set(clubLibrary.map((drill) => drill.id));

interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  error: string;
  settings: SyncSettingsValue;
  clubId: string | null;
  attention: AttentionItem[];
}

export const useSyncState = create<SyncState>(() => ({
  status: "local",
  pending: 0,
  lastSyncedAt: null,
  error: "",
  settings: { enabled: true, wifiOnly: false },
  clubId: null,
  attention: [],
}));

export function readSettings(): SyncSettingsValue {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<SyncSettingsValue>;
    return { enabled: raw.enabled !== false, wifiOnly: raw.wifiOnly === true };
  } catch {
    return { enabled: true, wifiOnly: false };
  }
}

export function writeSettings(next: SyncSettingsValue) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  useSyncState.setState({ settings: next });
}

type NetworkInformation = { type?: string; addEventListener?: (event: string, cb: () => void) => void };

/** "wifi", "cellular", or "unknown" (most iPhones and desktop browsers do not say). */
export function connectionType(): "wifi" | "cellular" | "unknown" {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  const type = connection?.type;
  if (type === "wifi" || type === "ethernet") return "wifi";
  if (type === "cellular") return "cellular";
  return "unknown";
}

function blockedReason(manual: boolean): SyncStatus | null {
  const { settings } = useSyncState.getState();
  if (!settings.enabled && !manual) return "off";
  if (!navigator.onLine) return "offline";
  // Wi-Fi only: automatic sync waits unless the browser confirms Wi-Fi. "Sync now" overrides.
  if (settings.wifiOnly && !manual && connectionType() !== "wifi") return "waiting-wifi";
  return null;
}

async function countPending(clubId: string | null) {
  const items = (await idbAll<OutboxItem>(OUTBOX)).filter((item) => item.clubId === clubId);
  useSyncState.setState({
    pending: items.filter((item) => !item.state).length,
    attention: items
      .filter((item) => item.state)
      .map((item) => ({
        key: item.key,
        table: item.table,
        localId: item.localId,
        label: String(item.row.title ?? (item.row.opponent ? `vs ${item.row.opponent} (${item.row.played_on ?? ""})` : item.localId)),
        state: item.state!,
        reason: item.reason ?? "",
      })),
  });
}

function metaKey(table: SyncTable, clubId: string, localId: string) {
  return `stamp:${table}:${clubId}:${localId}`;
}

export async function enqueue(table: SyncTable, clubId: string, localId: string, row: Record<string, unknown>) {
  const key = `${table}:${clubId}:${localId}`;
  await idbPut<OutboxItem>(OUTBOX, { key, table, clubId, localId, row });
  await idbPut<MetaItem>(META, { key: metaKey(table, clubId, localId), value: String(row.updated_at) });
  await countPending(clubId);
}

export function drillRow(clubId: string, drill: ClubDrill, board: DrillBoard | undefined, updatedAt: string) {
  return { club_id: clubId, local_id: drill.id, title: drill.title, drill, board: board ?? null, updated_at: updatedAt };
}

export function matchRow(clubId: string, match: SavedMatch) {
  const teamId = resolveMatchTeam(match);
  return {
    club_id: clubId,
    local_id: match.id,
    team_id: teamId,
    player_ids: resolveMatchPlayers(match, teamId),
    team_label: match.teamLabel ?? null,
    opponent: match.opponent,
    played_on: match.playedOn,
    duration_seconds: match.durationSeconds ?? null,
    our_score: match.ourScore ?? null,
    their_score: match.theirScore ?? null,
    formation: match.formation ?? null,
    detail: {
      minutes: match.minutes,
      players: match.players ?? [],
      events: match.events ?? [],
      layout: match.layout ?? null,
      teamId: match.teamId,
    },
    updated_at: match.updatedAt ?? new Date().toISOString(),
  };
}

let applyingRemote = false;
let running: Promise<void> | null = null;

/** Push the queue, then pull newer server records. */
export function syncNow(manual = false): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { clubId } = useSyncState.getState();
    const cloud = getCloud();
    if (!cloud || !clubId) return;
    const blocked = blockedReason(manual);
    if (blocked) {
      useSyncState.setState({ status: blocked });
      await countPending(clubId);
      return;
    }
    useSyncState.setState({ status: "syncing", error: "" });
    try {
      const items = (await idbAll<OutboxItem>(OUTBOX)).filter((item) => item.clubId === clubId);
      for (const queued of items) {
        if (queued.state) continue;
        const item = prepare(queued);
        if (item.table === "club_matches" && !item.row.team_id && !useTeamScope.getState().isAdmin) {
          await idbPut<OutboxItem>(OUTBOX, { ...item, state: "held", reason: "Choose the club team for this match." });
          continue;
        }
        const { error } = await cloud.from(item.table).upsert(item.row, { onConflict: "club_id,local_id" });
        if (error) {
          if (!isRejection(error)) throw error;
          const current = await idbGet<OutboxItem>(OUTBOX, item.key);
          if (current && current.row.updated_at === item.row.updated_at)
            await idbPut<OutboxItem>(OUTBOX, { ...item, state: "rejected", reason: rejectionText(error) });
          continue;
        }
        // Only drop the entry if nothing newer was queued meanwhile.
        const current = await idbGet<OutboxItem>(OUTBOX, item.key);
        if (current && current.row.updated_at === item.row.updated_at) await idbDelete(OUTBOX, item.key);
      }
      await pull(clubId);
      useSyncState.setState({ status: "idle", lastSyncedAt: new Date().toISOString() });
    } catch (problem) {
      useSyncState.setState({ status: navigator.onLine ? "error" : "offline", error: errorText(problem) });
    } finally {
      await countPending(clubId);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Rebuild a queued match row so it uses the current team mapping. */
function prepare(item: OutboxItem): OutboxItem {
  if (item.table !== "club_matches" || item.row.deleted_at) return item;
  const match = useClubStore.getState().matches.find((entry) => entry.id === item.localId);
  if (!match) return item;
  return { ...item, row: { ...matchRow(item.clubId, match), updated_at: item.row.updated_at } };
}

type PgError = { code?: string; message?: string };

/** Errors the server will repeat on every retry: permission (RLS) and data validation. */
function isRejection(error: PgError) {
  const code = error.code ?? "";
  return code === "42501" || code.startsWith("23") || code.startsWith("22") || code === "P0001" || /row-level security/i.test(error.message ?? "");
}

function rejectionText(error: PgError) {
  if (error.code === "42501" || /row-level security/i.test(error.message ?? ""))
    return "You are not on the staff of this match's team (or the record belongs to another team). Pick one of your teams, or ask a club admin.";
  return error.message ?? "The server refused this record.";
}

/** Retry held and rejected records (after a team is chosen or staff changes). */
export async function retryAttention(keys?: string[]) {
  for (const item of await idbAll<OutboxItem>(OUTBOX)) {
    if (!item.state || (keys && !keys.includes(item.key))) continue;
    await idbPut<OutboxItem>(OUTBOX, { ...item, state: undefined, reason: undefined });
  }
  await countPending(useSyncState.getState().clubId);
  void syncNow(true);
}

/** Stop trying to upload a record; it stays on this device. */
export async function keepLocalOnly(key: string) {
  await idbDelete(OUTBOX, key);
  await countPending(useSyncState.getState().clubId);
}

async function pull(clubId: string) {
  const cloud = getCloud()!;
  const sinceKey = `pulled:${clubId}`;
  const since = (await idbGet<MetaItem>(META, sinceKey))?.value ?? "1970-01-01T00:00:00Z";
  const [drills, matches] = await Promise.all([
    cloud.from("club_drills").select("local_id, drill, board, updated_at, deleted_at").eq("club_id", clubId).gt("updated_at", since),
    cloud.from("club_matches").select("local_id, team_id, opponent, played_on, duration_seconds, our_score, their_score, formation, team_label, detail, updated_at, deleted_at").eq("club_id", clubId).gt("updated_at", since),
  ]);
  if (drills.error) throw drills.error;
  if (matches.error) throw matches.error;
  let newest = since;
  const state = useClubStore.getState();
  let nextDrills = state.drills;
  let nextBoards = state.boards;
  let nextMatches = state.matches;

  for (const row of drills.data ?? []) {
    if (row.updated_at > newest) newest = row.updated_at;
    const stamp = (await idbGet<MetaItem>(META, metaKey("club_drills", clubId, row.local_id)))?.value;
    if (stamp && stamp >= row.updated_at) continue; // local copy is newer or the same
    await idbPut<MetaItem>(META, { key: metaKey("club_drills", clubId, row.local_id), value: row.updated_at });
    if (row.deleted_at) {
      nextDrills = nextDrills.filter((drill) => drill.id !== row.local_id);
      continue;
    }
    const drill = row.drill as ClubDrill;
    nextDrills = nextDrills.some((item) => item.id === drill.id)
      ? nextDrills.map((item) => (item.id === drill.id ? drill : item))
      : [drill, ...nextDrills];
    if (row.board) nextBoards = { ...nextBoards, [drill.id]: row.board as DrillBoard };
  }

  for (const row of matches.data ?? []) {
    if (row.updated_at > newest) newest = row.updated_at;
    const stamp = (await idbGet<MetaItem>(META, metaKey("club_matches", clubId, row.local_id)))?.value;
    if (stamp && stamp >= row.updated_at) continue;
    await idbPut<MetaItem>(META, { key: metaKey("club_matches", clubId, row.local_id), value: row.updated_at });
    if (row.deleted_at) {
      nextMatches = nextMatches.filter((match) => match.id !== row.local_id);
      continue;
    }
    const detail = (row.detail ?? {}) as Record<string, unknown>;
    const match: SavedMatch = {
      id: row.local_id,
      teamId: String(detail.teamId ?? ""),
      opponent: row.opponent,
      playedOn: row.played_on ?? "",
      minutes: (detail.minutes as SavedMatch["minutes"]) ?? [],
      players: (detail.players as SavedMatch["players"]) ?? [],
      events: (detail.events as SavedMatch["events"]) ?? [],
      layout: (detail.layout as SavedMatch["layout"]) ?? null,
      formation: row.formation ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      ourScore: row.our_score ?? undefined,
      theirScore: row.their_score ?? undefined,
      teamLabel: row.team_label ?? undefined,
      cloudTeamId: row.team_id ?? undefined,
      updatedAt: row.updated_at,
    };
    nextMatches = nextMatches.some((item) => item.id === match.id)
      ? nextMatches.map((item) => (item.id === match.id ? match : item))
      : [match, ...nextMatches];
  }

  if (nextDrills !== state.drills || nextBoards !== state.boards || nextMatches !== state.matches) {
    applyingRemote = true;
    try {
      useClubStore.setState({ drills: nextDrills, boards: nextBoards, matches: nextMatches });
    } finally {
      applyingRemote = false;
    }
  }
  await idbPut<MetaItem>(META, { key: sinceKey, value: newest });
}

/** Watches the on-device club store and queues changed drills and matches. */
export function watchClubStore(clubId: string) {
  let previous = useClubStore.getState();
  return useClubStore.subscribe((state) => {
    const before = previous;
    previous = state;
    if (applyingRemote || !state.hydrated || !before.hydrated) return;
    const now = new Date().toISOString();
    let changed = false;
    if (state.drills !== before.drills || state.boards !== before.boards) {
      const old = new Map(before.drills.map((drill) => [drill.id, drill]));
      for (const drill of state.drills) {
        if (LIBRARY_IDS.has(drill.id)) continue;
        if (old.get(drill.id) === drill && before.boards[drill.id] === state.boards[drill.id]) continue;
        void enqueue("club_drills", clubId, drill.id, drillRow(clubId, drill, state.boards[drill.id], now));
        changed = true;
      }
    }
    if (state.matches !== before.matches) {
      const old = new Map(before.matches.map((match) => [match.id, match]));
      for (const match of state.matches) {
        if (old.get(match.id) === match) continue;
        void enqueue("club_matches", clubId, match.id, matchRow(clubId, match));
        changed = true;
      }
    }
    if (changed) setTimeout(() => void syncNow(), 1500);
  });
}

/** Queue every club-created drill and every match (first sync on a device). */
export async function queueEverything(clubId: string) {
  const state = useClubStore.getState();
  const now = new Date().toISOString();
  for (const drill of state.drills) {
    if (LIBRARY_IDS.has(drill.id)) continue;
    const stamp = (await idbGet<MetaItem>(META, metaKey("club_drills", clubId, drill.id)))?.value;
    if (!stamp) await enqueue("club_drills", clubId, drill.id, drillRow(clubId, drill, state.boards[drill.id], now));
  }
  // One-off after the team-scope upgrade: re-send every match so it gains its club team id.
  const upgradeKey = `team-scope:${clubId}`;
  const upgraded = Boolean(await idbGet<MetaItem>(META, upgradeKey));
  for (const match of state.matches) {
    const stamp = (await idbGet<MetaItem>(META, metaKey("club_matches", clubId, match.id)))?.value;
    if (!stamp || !upgraded) {
      const row = matchRow(clubId, match);
      await enqueue("club_matches", clubId, match.id, stamp && match.updatedAt ? { ...row, updated_at: stamp > match.updatedAt ? stamp : match.updatedAt } : row);
    }
  }
  await idbPut<MetaItem>(META, { key: upgradeKey, value: "1" });
}

/** POPIA: on sign-out, remove queued records and the device copy of club coaching data. */
export async function clearDeviceData() {
  try {
    await idbClear();
  } catch {
    // IndexedDB unavailable (private mode): nothing stored.
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("bnfc-club-cloud-") || key === "football-live-match" || key.startsWith("football-team-")) localStorage.removeItem(key);
  }
  useSyncState.setState({ pending: 0, lastSyncedAt: null, clubId: null, attention: [] });
  useTeamScope.setState({ clubId: null, isAdmin: false, teams: [], players: [], map: {} });
}
