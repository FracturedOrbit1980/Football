/**
 * Synchronizes a team's roster from the primary Football platform into
 * Clubstride Lite & Pro using the standard cs.lite.roster.v1 contract.
 */
export interface SyncPlayerInput {
  id: string;
  name: string;
  squadNumber?: number;
  position?: string;
  photo?: string;
}

export interface SyncTeamOptions {
  // Launches select a squad. Background edits refresh only an already selected squad.
  activate?: boolean;
}

const ACTIVE_ROSTER_KEY = "cs.football.active-roster.v1";
const TEAM_CACHE_PREFIX = "cs.football.roster.v1.";

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Do not replace malformed saved data during a background refresh.
    return undefined;
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function localRoster(value: Record<string, unknown>) {
  return value.ownerId === undefined && value.cloudTeamId === undefined && value.readOnly === undefined;
}

export function syncTeamToLite(
  team: { id: string; name: string },
  players: SyncPlayerInput[],
  options: SyncTeamOptions = {},
) {
  if (typeof window === "undefined") return false;

  try {
    const rawInstallationId = localStorage.getItem("cs.lite.installation.v1");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const installationId =
      rawInstallationId && uuidRegex.test(rawInstallationId)
        ? rawInstallationId
        : "00000000-0000-0000-0000-000000000001";
    // Lite must reuse the installation under which this first local handoff was cached.
    if (rawInstallationId !== installationId) localStorage.setItem("cs.lite.installation.v1", installationId);

    // Sanitize team id and team name according to contract constraints
    const safeTeamId = (team.id || "team-default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
    const safeTeamName = (team.name || "Club Team").trim().slice(0, 200).replace(/[<>\u0000-\u001f\u007f]/g, "");

    const validPlayers = players.map((p, idx) => {
      const rawId = (p.id || `p-${idx}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
      const safeName = (p.name || `Player ${idx + 1}`).trim().slice(0, 60).replace(/[<>\u0000-\u001f\u007f]/g, "") || `Player ${idx + 1}`;
      const safePos = (p.position || "CM").trim().slice(0, 40).replace(/[<>\u0000-\u001f\u007f]/g, "") || "CM";
      const num =
        typeof p.squadNumber === "number" &&
        Number.isInteger(p.squadNumber) &&
        p.squadNumber >= 0 &&
        p.squadNumber <= 99
          ? p.squadNumber
          : 0;

      const row: {
        id: string;
        name: string;
        number: number;
        position: string;
        photo?: string;
        available: boolean;
      } = {
        id: rawId,
        name: safeName,
        number: num,
        position: safePos,
        available: true,
      };

      if (p.photo && typeof p.photo === "string" && p.photo.length <= 500000) {
        row.photo = p.photo;
      }
      return row;
    });

    // Football creates a browser-local squad. Coach assignments stay in Football;
    // ownerId/cloudTeamId/readOnly are reserved for authenticated Pro membership.
    const registry = object(readJson("bnfc-clubs"));
    const clubId = typeof registry?.activeId === "string" ? registry.activeId : null;
    const snapshot = {
      version: 1,
      installationId,
      teamId: safeTeamId,
      teamName: safeTeamName,
      players: validPlayers,
      revision: new Date().toISOString(),
    };

    // Cache by both club and installation: two clubs may reuse a team id.
    const clubKey = clubId === null ? "unscoped" : `club-${encodeURIComponent(clubId)}`;
    const cacheKey = `${TEAM_CACHE_PREFIX}${installationId}.${clubKey}.${safeTeamId}`;
    const previousCache = object(readJson(cacheKey));
    const previousTime = typeof previousCache?.revision === "string" ? Date.parse(previousCache.revision) : NaN;
    // Receivers use this revision to consume a background update once, including
    // two Football edits made within the same clock millisecond.
    snapshot.revision = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
    localStorage.setItem(cacheKey, JSON.stringify(snapshot));

    const current = object(readJson("cs.lite.roster.v1"));
    const binding = object(readJson(ACTIVE_ROSTER_KEY));
    const activate = options.activate !== false;
    const refreshActive = current !== null && binding !== null && clubId !== null &&
      current.version === 1 && Array.isArray(current.players) && localRoster(current) &&
      current.installationId === installationId && current.teamId === safeTeamId &&
      binding.installationId === installationId && binding.teamId === safeTeamId && binding.clubId === clubId;

    // Update compatible saved-team rows without changing Lite's current selection.
    // Unknown/foreign legacy identities and owned cloud rows are retained verbatim.
    const savedTeams = readJson("Clubstride Mobile_teams");
    if (savedTeams === null || Array.isArray(savedTeams)) {
      const teams: unknown[] = Array.isArray(savedTeams) ? savedTeams : [];
      const index = teams.findIndex((row) => object(row)?.id === safeTeamId);
      const existing = index < 0 ? null : object(teams[index]);
      if (index < 0 || (existing && localRoster(existing) &&
        existing.sharedInstallationId === installationId && existing.footballClubId === clubId)) {
        const row = { ...existing, id: safeTeamId, name: safeTeamName, squad: snapshot.players,
          sharedInstallationId: installationId, footballClubId: clubId };
        const next = [...teams];
        if (index < 0) next.push(row);
        else next[index] = row;
        localStorage.setItem("Clubstride Mobile_teams", JSON.stringify(next));
      }
    }

    if (!activate && !refreshActive) return true;

    localStorage.setItem("cs.lite.roster.v1", JSON.stringify(snapshot));
    localStorage.setItem("Clubstride Mobile_squad", JSON.stringify(snapshot.players));
    if (activate) {
      localStorage.setItem(ACTIVE_ROSTER_KEY, JSON.stringify({ installationId, teamId: safeTeamId, clubId }));
    }
    window.dispatchEvent(new CustomEvent("cs-lite-roster-change"));

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cs_sync_channel");
      channel.postMessage({ type: "cs-roster-update", roster: snapshot });
      channel.close();
    }
    return true;
  } catch (err) {
    console.warn("[Clubstride Sync] Failed to publish team to Lite storage:", err);
    return false;
  }
}
