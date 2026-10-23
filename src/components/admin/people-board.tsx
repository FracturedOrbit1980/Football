"use client";

import { useState } from "react";

import { PlayerUpload } from "@/components/admin/player-upload";
import { Button } from "@/components/ui/button";
import { PlayerPhotoField, PlayerPortrait } from "@/components/club/player-photo";
import { PositionFields } from "@/components/club/position-fields";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { formatPosition, normalizePositions, type PositionChoice, type StandardPosition } from "@/lib/club/positions";
import type { ClubPlayer } from "@/lib/club/seed";
import { useClubStore } from "@/stores/club-store";

export function PeopleBoard() {
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const players = useClubStore((state) => state.players);
  const addPlayer = useClubStore((state) => state.addPlayer);
  const updatePlayer = useClubStore((state) => state.updatePlayer);
  const addCoach = useClubStore((state) => state.addCoach);
  const coaches = useClubStore((state) => state.coaches);
  const teams = ageGroups.flatMap((group) =>
    group.teams.map((team) => ({ ...team, ageGroup: ageLabel(group.name) })),
  );
  const waiting = players.filter((player) => !player.teamId);
  const placed = players.filter((player) => player.teamId);

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 md:grid-cols-3">
        <Step n="1" title="Register" detail="Add each player with a number, starting position, and photo. A team is not required yet." />
        <Step n="2" title="Account" detail="Set the season fee and record payments on Accounting." />
        <Step n="3" title="Coach" detail="The head coach allocates the player to a team and league, then runs ratings and attendance." />
      </ol>
      <RegisterForm
        onSave={(input) => {
          addPlayer(input);
        }}
      />
      <PlayerUpload />
      <PlayerList
        title="Waiting for a coach"
        empty="Registered players who are not on a team yet appear here. Your head coach allocates them onto a team."
        players={waiting}
        teams={teams}
        onSave={updatePlayer}
      />
      <PlayerList
        title="On a team"
        empty="Players appear here once the head coach has allocated them."
        players={placed}
        teams={teams}
        onSave={updatePlayer}
      />
      <CoachAssign teams={teams} coaches={coaches} onAssign={addCoach} />
    </div>
  );
}

function CoachAssign({
  teams,
  coaches,
  onAssign,
}: {
  teams: { id: string; ageGroup: string; division?: string; name: string }[];
  coaches: { teamId: string; name: string }[];
  onAssign: (teamId: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  if (teams.length === 0) return null;
  return (
    <form
      className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-300 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !teamId) return;
        onAssign(teamId, name.trim());
        setName("");
      }}
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-bold text-slate-950">Coach for the team</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">The named coach allocates players from the list above and runs drills and attendance.</p>
      </div>
      <label className="block text-sm font-semibold text-slate-800">
        Coach
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base" required />
      </label>
      <label className="block min-w-0 text-sm font-semibold text-slate-800">
        Team and league
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base">
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.ageGroup} · {team.division ?? team.name}
              {coaches.find((coach) => coach.teamId === team.id) ? ` · ${coaches.find((coach) => coach.teamId === team.id)?.name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" className="h-11 sm:col-span-2 sm:w-fit">
        Assign coach
      </Button>
    </form>
  );
}

function Step({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <li className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-300">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Step {n}</p>
      <p className="mt-1 text-base font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{detail}</p>
    </li>
  );
}

function RegisterForm({
  onSave,
}: {
  onSave: (input: { name: string; squadNumber: number; position: string; positions: string[]; teamId: string; photo: string }) => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState(1);
  const [role, setRole] = useState<PositionChoice>("Central midfielder");
  const [roles, setRoles] = useState<StandardPosition[]>([]);
  const [photo, setPhoto] = useState("");

  return (
    <form
      className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-300 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          squadNumber: number,
          position: role,
          positions: roles,
          teamId: "",
          photo,
        });
        setName("");
        setPhoto("");
        setNumber((current) => Math.min(99, current + 1));
      }}
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-bold text-slate-950">Register a player</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">Add another after this one. The head coach can change the position or team later.</p>
      </div>
      <label className="text-sm font-semibold text-slate-800">
        Name
        <input
          value={name}
          data-field="register-name"
          onChange={(event) => setName(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          required
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Number
        <input
          type="number"
          min={1}
          max={99}
          value={number}
          onChange={(event) => setNumber(Number(event.target.value))}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
        />
      </label>
      <div className="sm:col-span-2">
        <PlayerPhotoField photo={photo} name={name} field="register-photo" onPhoto={setPhoto} />
      </div>
      <div className="sm:col-span-2">
        <p className="mb-1 text-sm font-semibold text-slate-800">Starting position</p>
        <PositionFields
          role={role}
          roles={roles}
          onRole={(next) => {
            setRole(next);
            if (next !== "All-rounder") setRoles([]);
          }}
          onToggle={(item) => setRoles((current) => (current.includes(item) ? current.filter((role) => role !== item) : [...current, item]))}
          field="register-position"
        />
      </div>
      <Button type="submit" size="lg" className="h-11 sm:col-span-2 sm:w-fit">
        Register player
      </Button>
    </form>
  );
}

function PlayerList({
  title,
  empty,
  players,
  teams,
  onSave,
}: {
  title: string;
  empty: string;
  players: ClubPlayer[];
  teams: { id: string; ageGroup: string; division?: string; name: string }[];
  onSave: (playerId: string, input: { name: string; squadNumber: number; position: string; positions?: string[]; photo?: string }) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-950">
        {title}
        <span className="ml-2 text-sm font-semibold text-slate-500">{players.length}</span>
      </h2>
      {players.length === 0 ? (
        <p className="mt-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {players
            .slice()
            .sort((a, b) => a.squadNumber - b.squadNumber || a.name.localeCompare(b.name))
            .map((player) => (
              <PlayerRow key={player.id} player={player} teams={teams} onSave={onSave} />
            ))}
        </ul>
      )}
    </section>
  );
}

function PlayerRow({
  player,
  teams,
  onSave,
}: {
  player: ClubPlayer;
  teams: { id: string; ageGroup: string; division?: string; name: string }[];
  onSave: (playerId: string, input: { name: string; squadNumber: number; position: string; positions?: string[]; photo?: string }) => void;
}) {
  const setPlayerPhoto = useClubStore((state) => state.setPlayerPhoto);
  const [open, setOpen] = useState(false);
  const stored = normalizePositions(player.position, player.positions);
  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(player.squadNumber);
  const [role, setRole] = useState<PositionChoice>(stored.position);
  const [roles, setRoles] = useState<StandardPosition[]>(stored.positions);
  const teamLabel = teams.find((team) => team.id === player.teamId);

  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-player={player.name}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
          <div className="min-w-0">
          <p className="text-base font-bold text-slate-950">
            {player.squadNumber} {player.name}
          </p>
          <p className="text-sm font-medium text-slate-600">{formatPosition(player)}</p>
          <p className="text-sm font-medium text-slate-600">
            {teamLabel ? `${teamLabel.ageGroup} · ${teamLabel.division ?? teamLabel.name}` : "Waiting for a coach to allocate this player"}
          </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="btn-quiet min-h-11 w-full shrink-0 rounded-xl px-3 py-2 text-left sm:w-auto"
        >
          <span className="block text-sm font-bold text-slate-950">{open ? "Close editor" : "Edit player"}</span>
          <span className="mt-0.5 block text-xs font-medium text-slate-600">Change the name, number, or position.</span>
        </button>
      </div>
      {open ? (
        <form
          className="mt-3 space-y-3 border-t border-slate-200 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onSave(player.id, { name: name.trim(), squadNumber: number, position: role, positions: roles });
            setOpen(false);
          }}
        >
          <label className="block text-sm font-semibold text-slate-800">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base" required />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Number
            <input type="number" min={1} max={99} value={number} onChange={(event) => setNumber(Number(event.target.value))} className="mt-1 block h-11 w-28 rounded-md border border-slate-300 px-3 text-base" />
          </label>
          <PositionFields
            role={role}
            roles={roles}
            onRole={(next) => {
              setRole(next);
              if (next !== "All-rounder") setRoles([]);
            }}
            onToggle={(item) => setRoles((current) => (current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]))}
            field={`edit-${player.id}`}
          />
          <PlayerPhotoField
            photo={player.photo}
            name={player.name}
            field="edit-photo"
            onPhoto={(next) => setPlayerPhoto(player.id, next)}
          />
          <Button type="submit" size="lg" className="h-11">
            Save player
          </Button>
        </form>
      ) : null}
    </li>
  );
}
