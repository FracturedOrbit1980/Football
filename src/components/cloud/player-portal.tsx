"use client";

import { CloudGate, Notice, Panel } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { PortalPrivacy } from "@/components/cloud/portal-privacy";
import { PlayerRadar } from "@/components/dashboard/player-radar";
import { formatZar } from "@/lib/cloud/money";
import { buildStatements } from "@/lib/cloud/statements";
import { playerName, type BudgetLine, type KitAllocation, type KitItem, type Player, type Rating, type SubsCharge, type Team } from "@/lib/cloud/types";

export function PlayerPortal() {
  return (
    <CloudGate roles={["PLAYER", "GUARDIAN"]}>
      <PortalScreen />
    </CloudGate>
  );
}

function PortalScreen() {
  // RLS limits every one of these queries to the signed-in player's (or guardian's child's) rows.
  const { data, error } = useClubData(
    async (cloud, club) => {
      const [players, ratings, budget, kit, kitItems, subs, teams] = await Promise.all([
        cloud.from("players").select("*").eq("club_id", club),
        cloud.from("player_ratings").select("*").eq("club_id", club).order("rated_on", { ascending: false }),
        cloud.from("budget_lines").select("*").eq("club_id", club),
        cloud.from("kit_allocations").select("*").eq("club_id", club),
        cloud.from("kit_items").select("*").eq("club_id", club),
        cloud.from("subs_charges").select("*").eq("club_id", club),
        cloud.from("teams").select("*").eq("club_id", club),
      ]);
      return {
        players: must<Player[]>(players),
        ratings: must<Rating[]>(ratings),
        budget: must<BudgetLine[]>(budget),
        kit: must<KitAllocation[]>(kit),
        kitItems: must<KitItem[]>(kitItems),
        subs: must<SubsCharge[]>(subs),
        teams: must<Team[]>(teams),
      };
    },
    { players: [], ratings: [], budget: [], kit: [], kitItems: [], subs: [], teams: [] } as {
      players: Player[]; ratings: Rating[]; budget: BudgetLine[]; kit: KitAllocation[]; kitItems: KitItem[]; subs: SubsCharge[]; teams: Team[];
    },
  );
  const statements = buildStatements(data.players, data);

  return (
    <>
      <Notice text={error} tone="error" />
      {data.players.length === 0 ? <p className="font-semibold text-slate-800">No player record is linked to your account yet.</p> : null}
      {statements.map((statement) => {
        const player = statement.player;
        const latest = data.ratings.find((rating) => rating.player_id === player.id);
        return (
          <div key={player.id}>
            <Panel title={playerName(player)}>
              <p className="text-base font-semibold text-slate-900">
                Player ID {player.player_code} · Card {player.card_ref ?? "not issued yet"} ·{" "}
                {data.teams.find((team) => team.id === player.team_id)?.name ?? "No team"}
                {player.squad_number !== null ? ` · #${player.squad_number}` : ""}
              </p>
            </Panel>
            {latest ? (
              <div className="mb-6">
                <PlayerRadar playerName={playerName(player)} scores={latest} caption={`Rated ${latest.rated_on}${latest.notes ? ` · ${latest.notes}` : ""}`} />
              </div>
            ) : null}
            <Panel title={`Statement · outstanding subs ${formatZar(statement.outstandingCents)}`}>
              {statement.lines.length === 0 ? <p className="text-sm font-semibold text-slate-600">Nothing on your statement yet.</p> : null}
              <ul className="space-y-1 text-sm font-semibold text-slate-900">
                {statement.lines.map((line, index) => (
                  <li key={index}>
                    {line.date} · {line.kind} · {line.description} · {formatZar(line.amountCents)} · {line.status}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        );
      })}
      <PortalPrivacy players={data.players} />
    </>
  );
}
