"use client";

import { useState } from "react";

import { PlayerUpload } from "@/components/admin/player-upload";
import { Button } from "@/components/ui/button";
import { PlayerPhotoField, PlayerPortrait } from "@/components/club/player-photo";
import { PositionFields } from "@/components/club/position-fields";
import { creditOf, outstandingOf, paidTotal, rand } from "@/lib/club/accounting";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { formatPosition, normalizePositions, type PositionChoice, type StandardPosition } from "@/lib/club/positions";
import { digitsOf, joinName, searchPlayers, splitName } from "@/lib/club/registration";
import { CORRESPONDENCE_CHANNELS, type ClubPlayer, type CorrespondenceChannel } from "@/lib/club/seed";
import { formatDay } from "@/lib/club/week";
import { useClubStore, type NewPlayerInput } from "@/stores/club-store";

type TeamOption = { id: string; ageGroup: string; division?: string; name: string };

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

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 md:grid-cols-3">
        <Step n="1" title="Register" detail="Capture the first name, surname, ID and mobile. The club issues a REG reference for every player." />
        <Step n="2" title="Account" detail="Set the season fee on Accounting, then send statements, agreements and sponsorship on Members." />
        <Step n="3" title="Coach" detail="The head coach allocates the player to a team and league, then runs ratings and attendance." />
      </ol>
      <RegisterForm players={players} onSave={addPlayer} />
      <PlayerUpload />
      <PlayerDirectory players={players} teams={teams} onSave={updatePlayer} />
      <CoachAssign teams={teams} coaches={coaches} onAssign={addCoach} />
    </div>
  );
}

function CoachAssign({
  teams,
  coaches,
  onAssign,
}: {
  teams: TeamOption[];
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
  players,
  onSave,
}: {
  players: ClubPlayer[];
  onSave: (input: NewPlayerInput) => string;
}) {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [number, setNumber] = useState(1);
  const [role, setRole] = useState<PositionChoice>("Central midfielder");
  const [roles, setRoles] = useState<StandardPosition[]>([]);
  const [photo, setPhoto] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-300 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice("");
        setError("");
        if (!firstName.trim() || !surname.trim()) {
          setError("Enter the player's first name and surname.");
          return;
        }
        const idDigits = digitsOf(idNumber);
        const duplicate = idDigits
          ? players.find((player) => player.idNumber && digitsOf(player.idNumber) === idDigits)
          : undefined;
        if (duplicate) {
          setError(`That ID number is already registered to ${duplicate.name} (${duplicate.regNumber}).`);
          return;
        }
        if (mobile.trim() && digitsOf(mobile).length < 7) {
          setError("Enter a mobile number with at least 7 digits.");
          return;
        }
        const name = joinName(firstName, surname);
        const reference = onSave({
          firstName,
          surname,
          idNumber,
          mobile,
          squadNumber: number,
          position: role,
          positions: roles,
          teamId: "",
          photo,
        });
        setNotice(`${name} registered as ${reference}.`);
        setFirstName("");
        setSurname("");
        setIdNumber("");
        setMobile("");
        setPhoto("");
        setNumber((current) => Math.min(99, current + 1));
      }}
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-bold text-slate-950">Register a player</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          The club issues a registration reference when you save. Add the ID and mobile number so the record is easy to find later. The head coach can change the position or team later.
        </p>
      </div>
      <label className="text-sm font-semibold text-slate-800">
        First name
        <input
          value={firstName}
          data-field="register-first-name"
          autoComplete="off"
          onChange={(event) => setFirstName(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          required
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Surname
        <input
          value={surname}
          data-field="register-surname"
          autoComplete="off"
          onChange={(event) => setSurname(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          required
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        ID number
        <input
          value={idNumber}
          data-field="register-id"
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => setIdNumber(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Mobile number
        <input
          value={mobile}
          data-field="register-mobile"
          type="tel"
          autoComplete="off"
          onChange={(event) => setMobile(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Shirt number
        <input
          type="number"
          min={1}
          max={99}
          value={number}
          data-field="register-number"
          onChange={(event) => setNumber(Number(event.target.value))}
          className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
        />
      </label>
      <div className="sm:col-span-2">
        <PlayerPhotoField photo={photo} name={joinName(firstName, surname)} field="register-photo" onPhoto={setPhoto} />
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
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" className="h-11">
          Register player
        </Button>
        {notice ? <p className="text-sm font-semibold text-emerald-800" data-registration-notice>{notice}</p> : null}
        {error ? <p className="text-sm font-semibold text-rose-700" data-registration-error>{error}</p> : null}
      </div>
    </form>
  );
}

function PlayerDirectory({
  players,
  teams,
  onSave,
}: {
  players: ClubPlayer[];
  teams: TeamOption[];
  onSave: (playerId: string, input: { name: string; squadNumber: number; position: string; positions?: string[]; photo?: string; firstName?: string; surname?: string; idNumber?: string; mobile?: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const labelOf = (player: ClubPlayer) => teamLabel(teams, player);
  const matches = searchPlayers(players, query, labelOf);
  const ordered = query.trim()
    ? matches
    : [...matches].sort(
        (a, b) =>
          (a.surname || a.name).localeCompare(b.surname || b.name) ||
          (a.firstName || "").localeCompare(b.firstName || "") ||
          a.regNumber.localeCompare(b.regNumber),
      );

  return (
    <section aria-label="Player records">
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
        <h2 className="text-lg font-bold text-slate-950">Find a player</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Search by reference, ID number, mobile number, first name or surname. Add another word to narrow the list. Open a player to see the record and correspondence history in place.
        </p>
        <label className="mt-3 block max-w-xl text-sm font-semibold text-slate-800">
          Search players
          <input
            type="search"
            value={query}
            data-field="player-search"
            placeholder="REG-0001, ID, mobile, name or surname"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <p className="mt-2 text-sm font-semibold text-slate-700" data-search-count>
          {query.trim()
            ? `${ordered.length} of ${players.length} ${players.length === 1 ? "player matches" : "players match"} "${query.trim()}".`
            : `${players.length} registered ${players.length === 1 ? "player" : "players"}. Choose one to open the record in place.`}
        </p>
      </div>
      {ordered.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">
          No player matches every word. Remove a word or try the registration reference.
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-player-results>
          {ordered.map((player) => {
            const open = selectedId === player.id;
            const outstanding = outstandingOf(player);
            const credit = creditOf(player);
            const balance = balanceChip(player, outstanding, credit);
            return (
              <li key={player.id}>
                <button
                  type="button"
                  data-player-result={player.regNumber}
                  aria-expanded={open}
                  onClick={() => setSelectedId(open ? "" : player.id)}
                  className={`flex w-full flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    open ? "ring-2 ring-emerald-600" : "ring-slate-300 hover:ring-emerald-600"
                  }`}
                >
                  <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
                  <span className="min-w-0 flex-1 basis-44">
                    <span className="block truncate text-base font-bold text-slate-950">{surnameFirst(player)}</span>
                    <span className="block truncate text-sm font-medium text-slate-600">
                      {player.idNumber ? `ID ${player.idNumber}` : "No ID captured"} · {player.mobile || "No mobile captured"}
                    </span>
                  </span>
                  <span className="w-28 shrink-0">
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Account</span>
                    <span className="block text-sm font-bold tabular-nums text-slate-950">{player.regNumber}</span>
                  </span>
                  <span className="w-32 shrink-0 sm:text-right">
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Outstanding</span>
                    <span className="block text-sm font-black tabular-nums text-slate-950">{rand(outstanding)}</span>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${balance.style}`}>{balance.label}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-sm font-bold text-emerald-700 sm:ml-0">{open ? "Hide record" : "View record"}</span>
                </button>
                {open ? (
                  <div className="mt-2">
                    <PlayerRecord
                      key={player.id}
                      player={player}
                      teamLabel={labelOf(player)}
                      onSave={onSave}
                      onClose={() => setSelectedId("")}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlayerRecord({
  player,
  teamLabel,
  onSave,
  onClose,
}: {
  player: ClubPlayer;
  teamLabel: string;
  onSave: (playerId: string, input: { name: string; squadNumber: number; position: string; positions?: string[]; photo?: string; firstName?: string; surname?: string; idNumber?: string; mobile?: string }) => void;
  onClose: () => void;
}) {
  const setPlayerPhoto = useClubStore((state) => state.setPlayerPhoto);
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const stored = normalizePositions(player.position, player.positions);
  const fallback = splitName(player.name);
  const [firstName, setFirstName] = useState(player.firstName || fallback.firstName);
  const [surname, setSurname] = useState(player.surname || fallback.surname);
  const [idNumber, setIdNumber] = useState(player.idNumber);
  const [mobile, setMobile] = useState(player.mobile);
  const [number, setNumber] = useState(player.squadNumber);
  const [role, setRole] = useState<PositionChoice>(stored.position);
  const [roles, setRoles] = useState<StandardPosition[]>(stored.positions);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<CorrespondenceChannel>("Note");
  const [note, setNote] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [historyError, setHistoryError] = useState("");
  const paid = paidTotal(player);
  const outstanding = outstandingOf(player);
  const credit = creditOf(player);

  return (
    <section className="rounded-xl bg-white p-3 ring-1 ring-slate-300" data-player-record={player.regNumber}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{player.regNumber}</p>
            <h2 className="break-words text-lg font-black text-slate-950">{surnameFirst(player)}</h2>
            <p className="text-sm font-medium text-slate-600">{teamLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11"
            aria-expanded={editing}
            onClick={() => setEditing((open) => !open)}
            data-field="edit-player-details"
          >
            {editing ? "Done editing" : "Edit details"}
          </Button>
          <Button type="button" size="lg" variant="outline" className="h-11" onClick={onClose} data-field="close-player-record">
            Close record
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3" data-player-identity>
          <Detail label="ID number" value={player.idNumber || "Not captured"} />
          <Detail label="Mobile" value={player.mobile || "Not captured"} />
          <Detail label="Squad number" value={String(player.squadNumber)} />
          <Detail label="Position" value={formatPosition(player)} />
        </dl>

        <div className="rounded-lg bg-slate-100 p-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Account</h3>
          <dl className="mt-2 grid gap-2 text-sm" data-player-account>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-700">Season fee</dt>
              <dd className="tabular-nums font-bold text-slate-950">{rand(player.seasonFee)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-700">Received</dt>
              <dd className="tabular-nums font-bold text-slate-950">{rand(paid)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-300 pt-2">
              <dt className="font-bold text-slate-900">{credit > 0 ? "In credit" : "Outstanding"}</dt>
              <dd className="tabular-nums font-black text-slate-950">{rand(credit > 0 ? credit : outstanding)}</dd>
            </div>
            {player.feeDueDate ? (
              <div className="flex justify-between gap-3">
                <dt className="font-medium text-slate-700">Fee due</dt>
                <dd className="font-semibold text-slate-900">{formatDay(player.feeDueDate)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-sm font-medium text-slate-600">Fees, payments and guardian statements are managed on Accounting.</p>
        </div>
      </div>

      {editing ? (
        <form
          className="mt-3 space-y-3 rounded-lg bg-slate-100 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSaved("");
            setError("");
            if (!firstName.trim() || !surname.trim()) {
              setError("First name and surname are required.");
              return;
            }
            if (mobile.trim() && digitsOf(mobile).length < 7) {
              setError("Enter a mobile number with at least 7 digits.");
              return;
            }
            const name = joinName(firstName, surname);
            onSave(player.id, {
              name,
              firstName,
              surname,
              idNumber,
              mobile,
              squadNumber: number,
              position: role,
              positions: roles,
            });
            setSaved(`Saved ${name}.`);
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Edit player details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">
              First name
              <input
                value={firstName}
                data-field="record-first-name"
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Surname
              <input
                value={surname}
                data-field="record-surname"
                onChange={(event) => setSurname(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              ID number
              <input
                value={idNumber}
                data-field="record-id"
                inputMode="numeric"
                onChange={(event) => setIdNumber(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Mobile number
              <input
                value={mobile}
                data-field="record-mobile"
                type="tel"
                onChange={(event) => setMobile(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Shirt number
              <input
                type="number"
                min={1}
                max={99}
                value={number}
                data-field="record-number"
                onChange={(event) => setNumber(Number(event.target.value))}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
          </div>
          <PositionFields
            role={role}
            roles={roles}
            onRole={(next) => {
              setRole(next);
              if (next !== "All-rounder") setRoles([]);
            }}
            onToggle={(item) => setRoles((current) => (current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]))}
            field={`record-${player.id}`}
          />
          <PlayerPhotoField
            photo={player.photo}
            name={player.name}
            field="record-photo"
            onPhoto={(next) => setPlayerPhoto(player.id, next)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" className="h-11">
              Save details
            </Button>
            {saved ? <p className="text-sm font-semibold text-emerald-800" data-record-notice>{saved}</p> : null}
            {error ? <p className="text-sm font-semibold text-rose-700" data-record-error>{error}</p> : null}
          </div>
        </form>
      ) : null}

      <div className="mt-3 border-t border-slate-200 pt-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Correspondence history
          <span className="ml-2 font-semibold text-slate-500">{player.correspondence.length}</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Registration, printed statements and emails sent from Accounting are logged automatically. Add a note for calls, SMS or conversations.
        </p>
        <form
          className="mt-2 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setHistoryNotice("");
            setHistoryError("");
            const text = note.trim();
            if (!text) {
              setHistoryError("Write what was discussed or sent before adding it.");
              return;
            }
            addCorrespondence(player.id, channel, text);
            setNote("");
            setHistoryNotice("Added to the correspondence history.");
          }}
        >
          <label className="block text-sm font-semibold text-slate-800">
            Type
            <select
              value={channel}
              data-field="correspondence-channel"
              onChange={(event) => setChannel(event.target.value as CorrespondenceChannel)}
              className="mt-1 block h-11 rounded-md border border-slate-300 bg-white px-3 text-base"
            >
              {CORRESPONDENCE_CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1 basis-56 text-sm font-semibold text-slate-800">
            Note
            <input
              value={note}
              data-field="correspondence-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Phoned the guardian about the outstanding fee"
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <Button type="submit" size="lg" className="h-11">
            Add to history
          </Button>
        </form>
        {historyNotice ? <p className="mt-2 text-sm font-semibold text-emerald-800" data-correspondence-notice>{historyNotice}</p> : null}
        {historyError ? <p className="mt-2 text-sm font-semibold text-rose-700" data-correspondence-error>{historyError}</p> : null}
        {player.correspondence.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">
            No correspondence yet.
          </p>
        ) : (
          <ol className="mt-3 space-y-2" data-correspondence>
            {player.correspondence.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-300" data-correspondence-entry={entry.channel}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">{entry.channel}</span>
                  <span className="text-xs font-semibold text-slate-600">{formatDay(entry.date)}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-900">{entry.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function teamLabel(teams: TeamOption[], player: ClubPlayer) {
  const team = teams.find((item) => item.id === player.teamId);
  return team ? `${team.ageGroup} · ${team.division ?? team.name}` : "Waiting for a coach to allocate this player";
}

function surnameFirst(player: ClubPlayer) {
  if (!player.surname) return player.name;
  return player.firstName ? `${player.surname}, ${player.firstName}` : player.surname;
}

function balanceChip(player: ClubPlayer, outstanding: number, credit: number): { label: string; style: string } {
  if (player.seasonFee <= 0) return { label: "No fee", style: "bg-slate-100 text-slate-700" };
  if (outstanding > 0) return { label: "Due", style: "bg-rose-100 text-rose-900" };
  if (credit > 0) return { label: "In credit", style: "bg-emerald-100 text-emerald-900" };
  return { label: "Settled", style: "bg-emerald-100 text-emerald-900" };
}
