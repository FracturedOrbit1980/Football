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

export function syncTeamToLite(
  team: { id: string; name: string },
  players: SyncPlayerInput[],
  coachName?: string
) {
  if (typeof window === "undefined") return;

  const rawInstallationId = localStorage.getItem("cs.lite.installation.v1");
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const installationId =
    rawInstallationId && uuidRegex.test(rawInstallationId)
      ? rawInstallationId
      : "00000000-0000-0000-0000-000000000001";

  // Sanitize team id and team name according to contract constraints
  const safeTeamId = (team.id || "team-default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
  const safeTeamName = (team.name || "Club Team").trim().slice(0, 200).replace(/[<>\u0000-\u001f\u007f]/g, "");

  const safeOwnerId =
    coachName && coachName.trim()
      ? coachName.trim().slice(0, 200).replace(/[<>\u0000-\u001f\u007f]/g, "")
      : undefined;

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

  const snapshot = {
    version: 1,
    installationId,
    teamId: safeTeamId,
    teamName: safeTeamName,
    ownerId: safeOwnerId,
    players: validPlayers,
    revision: new Date().toISOString(),
  };

  try {
    localStorage.setItem("cs.lite.roster.v1", JSON.stringify(snapshot));
    // Also cache squad in direct key for instantaneous offline loading
    localStorage.setItem("Clubstride Mobile_squad", JSON.stringify(snapshot.players));
    window.dispatchEvent(new CustomEvent("cs-lite-roster-change"));

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cs_sync_channel");
      channel.postMessage({ type: "cs-roster-update", roster: snapshot });
      channel.close();
    }
  } catch (err) {
    console.warn("[Clubstride Sync] Failed to publish team to Lite storage:", err);
  }
}
