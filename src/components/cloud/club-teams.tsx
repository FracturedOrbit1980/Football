"use client";

import { useState } from "react";

import { CloudGate, Field, Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import {
  CLUB_ROLE_LABEL,
  CLUB_ROLES,
  STAFF_ROLES,
  type AgeGroup,
  type ClubRole,
  type Invite,
  type Member,
  type StaffRole,
  type Team,
  type TeamStaff,
} from "@/lib/cloud/types";

export function ClubTeams() {
  return (
    <CloudGate roles={["CLUB_ADMIN"]}>
      <TeamsScreen />
    </CloudGate>
  );
}

function TeamsScreen() {
  const { data, error, reload, clubId } = useClubData(
    async (cloud, club) => {
      const [groups, teams, staff, members, invites] = await Promise.all([
        cloud.from("age_groups").select("*").eq("club_id", club).order("display_order"),
        cloud.from("teams").select("*").eq("club_id", club).order("name"),
        cloud.from("team_staff").select("*").eq("club_id", club),
        cloud.from("club_members").select("*").eq("club_id", club),
        cloud.from("club_invites").select("*").eq("club_id", club).order("created_at", { ascending: false }),
      ]);
      return {
        groups: must<AgeGroup[]>(groups),
        teams: must<Team[]>(teams),
        staff: must<TeamStaff[]>(staff),
        members: must<Member[]>(members),
        invites: must<Invite[]>(invites),
      };
    },
    { groups: [], teams: [], staff: [], members: [], invites: [] } as {
      groups: AgeGroup[];
      teams: Team[];
      staff: TeamStaff[];
      members: Member[];
      invites: Invite[];
    },
  );
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [groupName, setGroupName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ClubRole>("COACH");
  const [inviteTeam, setInviteTeam] = useState("");

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

  const cloud = getCloud()!;
  const nameOf = (userId: string) =>
    data.members.find((member) => member.user_id === userId)?.display_name ?? "Member";

  return (
    <>
      <Notice text={error} tone="error" />
      <Panel title="Age groups and teams">
        <div className="grid gap-3 sm:grid-cols-2">
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const order = Number(groupName.replace(/\D/g, "")) || data.groups.length + 1;
              if (await run(() => cloud.from("age_groups").insert({ club_id: clubId, name: groupName.trim(), display_order: order }), "Age group added."))
                setGroupName("");
            }}
          >
            <Field label="New age group" placeholder="U12" required value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            <Button type="submit" className="h-11">Add age group</Button>
          </form>
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await run(() => cloud.from("teams").insert({ club_id: clubId, age_group_id: teamGroup, name: teamName.trim() }), "Team added."))
                setTeamName("");
            }}
          >
            <Select label="Age group" required value={teamGroup} onChange={(event) => setTeamGroup(event.target.value)}>
              <option value="">Choose…</option>
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </Select>
            <Field label="Team name" placeholder="U12 Prem" required value={teamName} onChange={(event) => setTeamName(event.target.value)} />
            <Button type="submit" className="h-11">Add team</Button>
          </form>
        </div>
      </Panel>

      {data.groups.map((group) => (
        <Panel key={group.id} title={group.name}>
          {data.teams.filter((team) => team.age_group_id === group.id).length === 0 ? (
            <p className="text-sm font-semibold text-slate-600">No teams yet.</p>
          ) : null}
          <div className="space-y-3">
            {data.teams
              .filter((team) => team.age_group_id === group.id)
              .map((team) => (
                <div key={team.id} className="rounded-lg p-3 ring-1 ring-slate-200">
                  <p className="font-bold text-slate-950">{team.name}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {STAFF_ROLES.map((role) => {
                      const current = data.staff.find((row) => row.team_id === team.id && row.role === role);
                      const eligible = data.members.filter((member) => member.role === role);
                      return (
                        <Select
                          key={role}
                          label={`${CLUB_ROLE_LABEL[role]}${role === "FITNESS" ? " (optional)" : ""}`}
                          value={current?.user_id ?? ""}
                          onChange={async (event) => {
                            const userId = event.target.value;
                            if (!userId) {
                              await run(() => cloud.from("team_staff").delete().match({ team_id: team.id, role }), "Staff removed.");
                              return;
                            }
                            await run(
                              () =>
                                cloud
                                  .from("team_staff")
                                  .upsert({ team_id: team.id, club_id: clubId, user_id: userId, role: role as StaffRole }, { onConflict: "team_id,role" }),
                              `${CLUB_ROLE_LABEL[role]} set for ${team.name}.`,
                            );
                          }}
                        >
                          <option value="">{current ? "Remove" : "Nobody"}</option>
                          {eligible.map((member) => (
                            <option key={member.id} value={member.user_id}>{member.display_name ?? "Member"}</option>
                          ))}
                        </Select>
                      );
                    })}
                  </div>
                  {data.staff.some((row) => row.team_id === team.id) ? (
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      {data.staff.filter((row) => row.team_id === team.id).map((row) => `${CLUB_ROLE_LABEL[row.role]}: ${nameOf(row.user_id)}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        </Panel>
      ))}

      <Panel title="Invite by email">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const staff = (STAFF_ROLES as readonly string[]).includes(inviteRole);
            if (await run(
              () =>
                cloud.from("club_invites").insert({
                  club_id: clubId,
                  email: inviteEmail.trim().toLowerCase(),
                  role: inviteRole,
                  team_id: staff && inviteTeam ? inviteTeam : null,
                }),
              `Invite saved. ${inviteEmail} joins after signing in with that address.`,
            ))
              setInviteEmail("");
          }}
        >
          <Field label="Email" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          <Select label="Role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ClubRole)}>
            {CLUB_ROLES.filter((role) => role !== "PLAYER" && role !== "GUARDIAN").map((role) => (
              <option key={role} value={role}>{CLUB_ROLE_LABEL[role]}</option>
            ))}
          </Select>
          <Select label="Team (staff roles)" value={inviteTeam} onChange={(event) => setInviteTeam(event.target.value)}>
            <option value="">No team yet</option>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </Select>
          <Button type="submit" className="h-11 self-end">Save invite</Button>
        </form>
        <p className="mt-2 text-xs font-medium text-slate-600">
          Players and guardians are invited from the Players screen so the invite links to the right player.
        </p>
        <Notice text={notice} />
        <Notice text={failure} tone="error" />
      </Panel>

      <Panel title="Members and invites">
        <ul className="space-y-1 text-sm font-semibold text-slate-900">
          {data.members.map((member) => (
            <li key={member.id}>
              {member.display_name ?? "Member"} · {CLUB_ROLE_LABEL[member.role]}
            </li>
          ))}
          {data.invites.filter((invite) => !invite.accepted_at).map((invite) => (
            <li key={invite.id} className="text-slate-600">
              {invite.email} · {CLUB_ROLE_LABEL[invite.role]} · invited, not signed in yet{" "}
              <button type="button" className="underline" onClick={() => run(() => cloud.from("club_invites").delete().eq("id", invite.id), "Invite withdrawn.")}>
                Withdraw
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
