"use client";

import { useState } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { CloudGate, Field, Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { playerName, type Guardian, type Player, type Team } from "@/lib/cloud/types";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

type Data = { players: Player[]; guardians: Guardian[]; teams: Team[] };

const EMPTY_FORM = {
  first: "",
  last: "",
  dob: "",
  position: "",
  number: "",
  team: "",
  gName: "",
  gRelationship: "Parent",
  gEmail: "",
  gPhone: "",
  gAltPhone: "",
  consent: false,
};

export function ClubPlayers() {
  return (
    <CloudGate roles={["CLUB_ADMIN", "TEAM_MANAGER", "COACH", "FITNESS"]}>
      <PlayersScreen />
    </CloudGate>
  );
}

function PlayersScreen() {
  const session = useCloudSession();
  const isAdmin = session.hasRole("CLUB_ADMIN");
  const canRegister = isAdmin || session.hasRole("TEAM_MANAGER");
  const { data, error, reload, clubId } = useClubData<Data>(
    async (cloud, club) => {
      const [players, guardians, teams] = await Promise.all([
        cloud.from("players").select("*").eq("club_id", club).order("last_name"),
        cloud.from("guardians").select("*").eq("club_id", club),
        cloud.from("teams").select("*").eq("club_id", club).order("name"),
      ]);
      return { players: must<Player[]>(players), guardians: must<Guardian[]>(guardians), teams: must<Team[]>(teams) };
    },
    { players: [], guardians: [], teams: [] },
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterTeam, setFilterTeam] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const cloud = getCloud()!;

  async function run(action: () => PromiseLike<{ error: unknown }>, done: string) {
    setFailure("");
    const { error: problem } = await action();
    if (problem) {
      setFailure(errorText(problem));
      return false;
    }
    setNotice(done);
    reload();
    return true;
  }

  const set = (key: keyof typeof EMPTY_FORM) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const teamName = (id: string | null) => data.teams.find((team) => team.id === id)?.name ?? "No team";
  const shown = data.players.filter((player) => !filterTeam || player.team_id === filterTeam);

  return (
    <>
      <Notice text={error} tone="error" />
      {canRegister ? (
        <Panel title="Register a player">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await run(
                () =>
                  cloud.rpc("register_player", {
                    p_club: clubId,
                    p_team: form.team || null,
                    p_first_name: form.first,
                    p_last_name: form.last,
                    p_date_of_birth: form.dob || null,
                    p_position: form.position || null,
                    p_squad_number: form.number ? Number(form.number) : null,
                    p_guardian_name: form.gName,
                    p_guardian_relationship: form.gRelationship,
                    p_guardian_email: form.gEmail,
                    p_guardian_phone: form.gPhone,
                    p_guardian_alt_phone: form.gAltPhone || null,
                    p_guardian_consent: form.consent,
                    p_policy_version: PRIVACY_POLICY_VERSION,
                  }),
                `${form.first} ${form.last} registered. A player ID was issued.`,
              );
              if (ok) setForm(EMPTY_FORM);
            }}
          >
            <Field label="First name" required value={form.first} onChange={set("first")} />
            <Field label="Last name" required value={form.last} onChange={set("last")} />
            <Field label="Date of birth" type="date" value={form.dob} onChange={set("dob")} />
            <Field label="Position" value={form.position} onChange={set("position")} />
            <Field label="Squad number" type="number" min={0} max={999} value={form.number} onChange={set("number")} />
            <Select label="Team" value={form.team} onChange={set("team")} required={!isAdmin}>
              <option value="">{isAdmin ? "Not allocated yet" : "Choose your team…"}</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
            <Field label="Guardian full name" required value={form.gName} onChange={set("gName")} />
            <Field label="Relationship" value={form.gRelationship} onChange={set("gRelationship")} />
            <Field label="Guardian email" type="email" required value={form.gEmail} onChange={set("gEmail")} />
            <Field label="Guardian mobile" type="tel" required placeholder="+27 82 123 4567" pattern="\+?[0-9 \(\)\-]{9,20}" value={form.gPhone} onChange={set("gPhone")} />
            <Field label="Other contact number" type="tel" pattern="\+?[0-9 \(\)\-]{9,20}" value={form.gAltPhone} onChange={set("gAltPhone")} />
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-800 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))}
                className="mt-1 size-5"
              />
              <span>
                The guardian has read the{" "}
                <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/privacy/?club=${clubId}`} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">
                  privacy and POPIA notice
                </a>{" "}
                (version {PRIVACY_POLICY_VERSION}) and consents to the club processing this player&apos;s and their own
                personal information for club administration.
              </span>
            </label>
            <Button type="submit" className="h-11 sm:col-span-2 lg:col-span-3">Register player</Button>
          </form>
          <Notice text={notice} />
          <Notice text={failure} tone="error" />
        </Panel>
      ) : (
        <>
          <Notice text={notice} />
          <Notice text={failure} tone="error" />
        </>
      )}

      <Panel
        title={`Players (${shown.length})`}
        actions={
          <select aria-label="Filter by team" value={filterTeam} onChange={(event) => setFilterTeam(event.target.value)} className="h-11 rounded-md border border-slate-300 px-2">
            <option value="">All my teams</option>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        }
      >
        <ul className="space-y-3">
          {shown.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              guardians={data.guardians.filter((guardian) => guardian.player_id === player.id)}
              teams={data.teams}
              teamName={teamName(player.team_id)}
              isAdmin={isAdmin}
              canEdit={canRegister}
              run={run}
            />
          ))}
        </ul>
      </Panel>
    </>
  );
}

function PlayerRow({
  player,
  guardians,
  teams,
  teamName,
  isAdmin,
  canEdit,
  run,
}: {
  player: Player;
  guardians: Guardian[];
  teams: Team[];
  teamName: string;
  isAdmin: boolean;
  canEdit: boolean;
  run: (action: () => PromiseLike<{ error: unknown }>, done: string) => Promise<boolean>;
}) {
  const cloud = getCloud()!;
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg p-3 ring-1 ring-slate-200">
      <button type="button" className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="text-base font-bold text-slate-950">
          {playerName(player)} {player.squad_number !== null ? <span className="text-slate-600">#{player.squad_number}</span> : null}
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {player.player_code} · Card {player.card_ref ?? "not issued"} · {teamName}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          {guardians.length === 0 ? (
            <p className="text-sm font-semibold text-slate-600">Guardian details are visible to the club admin and the team manager.</p>
          ) : (
            guardians.map((guardian) => (
              <p key={guardian.id} className="text-sm font-semibold text-slate-800">
                {guardian.full_name} ({guardian.relationship ?? "Guardian"}) · {guardian.email} · {guardian.phone}
                {guardian.alt_phone ? ` · ${guardian.alt_phone}` : ""} · {guardian.user_id ? "portal linked" : "no portal account"}
              </p>
            ))
          )}
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Team"
                value={player.team_id ?? ""}
                onChange={(event) =>
                  run(() => cloud.from("players").update({ team_id: event.target.value || null }).eq("id", player.id), "Team updated.")
                }
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </Select>
              <Button type="button" variant="secondary" className="h-11" onClick={() => run(() => cloud.rpc("issue_player_card", { p_player: player.id }), "Player card issued.")}>
                {player.card_ref ? "Re-issue card" : "Issue player card"}
              </Button>
            </div>
          ) : null}
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {guardians.map((guardian) => (
                <Button
                  key={guardian.id}
                  type="button"
                  variant="secondary"
                  className="h-11"
                  disabled={!!guardian.user_id}
                  onClick={() =>
                    run(
                      () => cloud.from("club_invites").insert({ club_id: player.club_id, email: guardian.email, role: "GUARDIAN", player_id: player.id }),
                      `Portal invite saved for ${guardian.email}. They sign in with that address.`,
                    )
                  }
                >
                  Invite {guardian.full_name} to the portal
                </Button>
              ))}
              <InvitePlayer player={player} run={run} />
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                onClick={() => {
                  if (window.confirm(`Delete ${playerName(player)} and all their records? This cannot be undone.`)) {
                    void run(() => cloud.from("players").delete().eq("id", player.id), "Player and their records deleted.");
                  }
                }}
              >
                Delete player
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function InvitePlayer({ player, run }: { player: Player; run: (action: () => PromiseLike<{ error: unknown }>, done: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  if (player.user_id) return <p className="self-center text-sm font-semibold text-slate-700">Player has a portal account.</p>;
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await run(() => getCloud()!.from("club_invites").insert({ club_id: player.club_id, email: email.trim().toLowerCase(), role: "PLAYER", player_id: player.id }), `Portal invite saved for ${email}.`))
          setEmail("");
      }}
    >
      <Field label="Player's own email (optional)" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button type="submit" variant="secondary" className="h-11">Invite player</Button>
    </form>
  );
}
