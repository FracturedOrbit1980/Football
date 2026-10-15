"use client";

import { create } from "zustand";

import { getCloud } from "@/lib/cloud/client";
import type { SavedMatch } from "@/lib/club/seed";

/*
 * Club mode: matches belong to real club teams (Supabase team ids). The on-device club
 * workspace has its own local team ids, so we keep a per-club map local team -> club team.
 * A match resolves to: its own cloudTeamId, else the mapped team, else a club team with the
 * same name. Only teams this user may write are candidates (all teams for a club admin).
 */

export interface CloudTeam {
  id: string;
  name: string;
}
export interface CloudPlayer {
  id: string;
  teamId: string | null;
  name: string;
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
  const [teams, staff, players] = await Promise.all([
    cloud.from("teams").select("id, name").eq("club_id", clubId).order("name"),
    cloud.from("team_staff").select("team_id").eq("club_id", clubId).eq("user_id", userId),
    cloud.from("players").select("id, team_id, first_name, last_name").eq("club_id", clubId),
  ]);
  if (teams.error || staff.error || players.error) return;
  const mine = new Set((staff.data ?? []).map((row) => row.team_id as string));
  const next = {
    teams: (teams.data ?? []).filter((team) => isAdmin || mine.has(team.id)).map((team) => ({ id: team.id, name: team.name })),
    players: (players.data ?? []).map((p) => ({ id: p.id, teamId: p.team_id, name: `${p.first_name} ${p.last_name}` })),
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
    const wanted = norm(player.name);
    const hit =
      players.find((p) => p.teamId === teamId && norm(p.name) === wanted) ?? players.find((p) => norm(p.name) === wanted);
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}
