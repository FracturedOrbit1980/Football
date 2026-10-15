"use client";

import { create } from "zustand";

import { getCloud } from "@/lib/cloud/client";
import type { SavedMatch } from "@/lib/club/seed";
import { useClubStore } from "@/stores/club-store";

/*
 * Club mode: matches belong to real club teams (Supabase team ids). The on-device club
 * workspace has its own local team ids, so we keep a per-club map local team -> club team.
 * A match resolves to: its own cloudTeamId, else the mapped team, else a club team with the
 * same name. Only teams this user may write are candidates (all teams for a club admin).
 */

export interface CloudTeam {
  id: string;
  name: string;
  ageGroup?: string;
}
export interface CloudPlayer {
  id: string;
  teamId: string | null;
  name: string;
  squadNumber?: number | null;
  position?: string | null;
}

interface TeamScope {
  clubId: string | null;
  isAdmin: boolean;
  teams: CloudTeam[];
  players: CloudPlayer[];
  map: Record<string, string>;
}

export const useTeamScope = create<TeamScope>(() => ({ clubId: null, isAdmin: false, teams: [], players: [], map: {} }));

const cacheKey = (clubId: string) => `football-team-scope-${clubId}`;
const mapKey = (clubId: string) => `football-team-map-${clubId}`;
const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Load (or restore offline) the teams and players this user may record matches for. */
export async function loadTeamScope(clubId: string, userId: string, isAdmin: boolean) {
  const cached = readJson<{ teams: CloudTeam[]; players: CloudPlayer[] }>(cacheKey(clubId), { teams: [], players: [] });
  useTeamScope.setState({ clubId, isAdmin, teams: cached.teams, players: cached.players, map: readJson(mapKey(clubId), {}) });
  const cloud = getCloud();
  if (!cloud || !navigator.onLine) return;
  const [teams, staff, players, groups] = await Promise.all([
    cloud.from("teams").select("id, name, age_group_id").eq("club_id", clubId).order("name"),
    cloud.from("team_staff").select("team_id").eq("club_id", clubId).eq("user_id", userId),
    cloud.from("players").select("id, team_id, first_name, last_name, squad_number, position").eq("club_id", clubId),
    cloud.from("age_groups").select("id, name").eq("club_id", clubId),
  ]);
  if (teams.error || staff.error || players.error) return;
  const groupName = new Map((groups.data ?? []).map((group) => [group.id as string, group.name as string]));
  const mine = new Set((staff.data ?? []).map((row) => row.team_id as string));
  const next = {
    teams: (teams.data ?? []).filter((team) => isAdmin || mine.has(team.id)).map((team) => ({ id: team.id, name: team.name, ageGroup: groupName.get(team.age_group_id) })),
    players: (players.data ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: `${p.first_name} ${p.last_name}`,
      squadNumber: p.squad_number,
      position: p.position,
    })),
  };
  localStorage.setItem(cacheKey(clubId), JSON.stringify(next));
  if (useTeamScope.getState().clubId === clubId) useTeamScope.setState(next);
}

export function setTeamMapping(localTeamId: string, cloudTeamId: string | null) {
  const { clubId, map } = useTeamScope.getState();
  if (!clubId) return;
  const next = { ...map };
  if (cloudTeamId) next[localTeamId] = cloudTeamId;
  else delete next[localTeamId];
  localStorage.setItem(mapKey(clubId), JSON.stringify(next));
  useTeamScope.setState({ map: next });
}

/** The club team for a local team (mapping first, then same name). */
export function cloudTeamFor(localTeamId: string, localName?: string): string | null {
  const { teams, map } = useTeamScope.getState();
  const mapped = map[localTeamId];
  if (mapped && teams.some((team) => team.id === mapped)) return mapped;
  if (localName) return teams.find((team) => norm(team.name) === norm(localName))?.id ?? null;
  return null;
}

export function resolveMatchTeam(match: SavedMatch): string | null {
  const { teams } = useTeamScope.getState();
  if (match.cloudTeamId && teams.some((team) => team.id === match.cloudTeamId)) return match.cloudTeamId;
  return cloudTeamFor(match.teamId, match.teamLabel);
}

/** Club player ids for the squad, matched by name within the club team (then the club). */
export function resolveMatchPlayers(match: SavedMatch, teamId: string | null): string[] {
  const { players } = useTeamScope.getState();
  const ids = new Set<string>();
  for (const player of match.players ?? []) {
    // Squads imported from the club carry the club player id.
    if (player.playerId.startsWith("cloud-") && players.some((p) => `cloud-${p.id}` === player.playerId)) {
      ids.add(player.playerId.slice(6));
      continue;
    }
    const wanted = norm(player.name);
    const hit =
      players.find((p) => p.teamId === teamId && norm(p.name) === wanted) ?? players.find((p) => norm(p.name) === wanted);
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

/**
 * Club mode: copy the club teams this user coaches (and their players) into the device
 * workspace so the live match, roster and attendance start with the real squad.
 * Adds and renames; never deletes local data. Local ids are "cloud-<club id>".
 */
export function importClubSquads() {
  const { teams, players } = useTeamScope.getState();
  const store = useClubStore.getState();
  if (!store.hydrated || teams.length === 0) return;
  let ageGroups = store.ageGroups;
  let changed = false;
  for (const team of teams) {
    const localId = `cloud-${team.id}`;
    const wanted = team.ageGroup || /U\d+/i.exec(team.name)?.[0] || "Club teams";
    let group = ageGroups.find((item) => norm(item.name) === norm(wanted));
    if (!group) {
      // e.g. U14+ or a senior side: add the club's age group to this device.
      const number = Number(/\d+/.exec(wanted)?.[0] ?? 99);
      group = { id: `cloud-ag-${norm(wanted).replace(/\W+/g, "-")}`, name: wanted, displayOrder: number, teams: [] };
      ageGroups = [...ageGroups, group];
      changed = true;
    }
    const existing = ageGroups.flatMap((item) => item.teams).find((item) => item.id === localId);
    if (existing && existing.name === team.name) continue;
    changed = true;
    ageGroups = ageGroups.map((item) => ({
      ...item,
      teams:
        item.id === group.id
          ? existing
            ? item.teams.map((t) => (t.id === localId ? { ...t, name: team.name } : t))
            : [...item.teams, { id: localId, name: team.name }]
          : item.teams,
    }));
  }
  const teamIds = new Set(teams.map((team) => team.id));
  let localPlayers = store.players;
  for (const player of players) {
    if (!player.teamId || !teamIds.has(player.teamId)) continue;
    const localId = `cloud-${player.id}`;
    const next = {
      id: localId,
      name: player.name,
      squadNumber: player.squadNumber ?? 0,
      position: player.position || "CM",
      teamId: `cloud-${player.teamId}`,
      homework: "",
    };
    const current = localPlayers.find((item) => item.id === localId);
    if (current && current.name === next.name && current.teamId === next.teamId && current.squadNumber === next.squadNumber) continue;
    changed = true;
    localPlayers = current
      ? localPlayers.map((item) => (item.id === localId ? { ...item, ...next, homework: item.homework } : item))
      : [...localPlayers, next];
  }
  if (changed) useClubStore.setState({ ageGroups, players: localPlayers });
  for (const team of teams) if (!useTeamScope.getState().map[`cloud-${team.id}`]) setTeamMapping(`cloud-${team.id}`, team.id);
}
