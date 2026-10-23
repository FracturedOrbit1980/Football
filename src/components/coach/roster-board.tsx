"use client";

import { useRef, useState } from "react";

import { PlayerPhotoField, PlayerPortrait } from "@/components/club/player-photo";
import { PositionFields } from "@/components/club/position-fields";
import { Button } from "@/components/ui/button";
import { useCoachTeam } from "@/components/coach/team-picker";
import { formatPosition, normalizePositions, type PositionChoice, type StandardPosition } from "@/lib/club/positions";
import type { ClubPlayer } from "@/lib/club/seed";
import { addDays, formatDay, mondayOf, sessionToday, weekDates } from "@/lib/club/week";
import { useClubStore } from "@/stores/club-store";

export function RosterBoard() {
  const players = useClubStore((state) => state.players);
  const evaluations = useClubStore((state) => state.evaluations);
  const addEvaluation = useClubStore((state) => state.addEvaluation);
  const setHomework = useClubStore((state) => state.setHomework);
  const { team, teams } = useCoachTeam();
  const assignPlayer = useClubStore((state) => state.assignPlayer);
  const squad = players
    .filter((player) => player.teamId === team?.id)
    .sort((a, b) => a.squadNumber - b.squadNumber);
  const [selectedId, setSelectedId] = useState("");
  const selected = squad.find((player) => player.id === selectedId) ?? null;
  const [scores, setScores] = useState({ technical: 6, tactical: 6, physical: 6, mental: 6 });
  const [notes, setNotes] = useState("");
  const [homework, setHomeworkText] = useState(selected?.homework ?? "");
  const [saved, setSaved] = useState("");
  const initialPosition = normalizePositions(selected?.position ?? "Central midfielder", selected?.positions);
  const [editName, setEditName] = useState(selected?.name ?? "");
  const [editNumber, setEditNumber] = useState(selected?.squadNumber ?? 1);
  const [editRole, setEditRole] = useState<PositionChoice>(initialPosition.position);
  const [editRoles, setEditRoles] = useState<StandardPosition[]>(initialPosition.positions);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updatePlayer = useClubStore((state) => state.updatePlayer);
  const setPlayerPhoto = useClubStore((state) => state.setPlayerPhoto);
  const setPlayerPin = useClubStore((state) => state.setPlayerPin);
  const deletePlayer = useClubStore((state) => state.deletePlayer);
  const [pin, setPinValue] = useState(selected?.accessPin ?? "");
  const [pinNotice, setPinNotice] = useState("");
  const [weekStart, setWeekStart] = useState(() => mondayOf(sessionToday()));
  const dates = weekDates(weekStart);
  const loadedId = useRef(selected?.id ?? "");
  if ((selected?.id ?? "") !== loadedId.current) {
    loadedId.current = selected?.id ?? "";
    const nextPosition = normalizePositions(selected?.position ?? "Central midfielder", selected?.positions);
    setEditName(selected?.name ?? "");
    setEditNumber(selected?.squadNumber ?? 1);
    setEditRole(nextPosition.position);
    setEditRoles(nextPosition.positions);
    setHomeworkText(selected?.homework ?? "");
    setPinValue(selected?.accessPin ?? "");
    setPinNotice("");
    setConfirmDelete(false);
  }

  function selectPlayer(playerId: string) {
    const player = squad.find((item) => item.id === playerId);
    setSelectedId(playerId);
    setHomeworkText(player?.homework ?? "");
    const nextPosition = normalizePositions(player?.position ?? "Central midfielder", player?.positions);
    setEditName(player?.name ?? "");
    setEditNumber(player?.squadNumber ?? 1);
    setEditRole(nextPosition.position);
    setEditRoles(nextPosition.positions);
    setPinValue(player?.accessPin ?? "");
    setPinNotice("");
    setConfirmDelete(false);
    setSaved("");
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-white px-4 py-3 font-semibold text-slate-800 ring-1 ring-slate-300">
          {team
            ? squad.length === 0
              ? `${team.ageGroup} · ${team.division ?? team.name} has no players yet. Allocate a registered player below.`
              : `${squad.length} players. Tap one to open their rating, details, and training week.`
            : "Open an age and a league on Home. Attendance starts after players are allocated."}
        </p>
        {squad.length > 0 ? (
          <ul className="space-y-3" data-squad-list>
            {squad.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => selectPlayer(player.id)}
                  data-squad-player={player.name}
                  className="grid min-h-11 w-full grid-cols-[2.75rem_2.25rem_minmax(0,1fr)_auto] items-center gap-x-4 rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-slate-300 sm:px-5"
                >
                  <span className="row-span-2">
                    <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
                  </span>
                  <span className="row-span-2 text-lg font-black tabular-nums text-slate-950">{player.squadNumber}</span>
                  <span className="min-w-0 truncate font-semibold text-slate-950">{player.name}</span>
                  <span className="text-sm font-bold text-slate-700">Open</span>
                  <span className="col-start-3 truncate text-sm text-slate-600">{formatPosition(player)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {team ? <GameDay teamId={team.id} teamName={team.name} gameDay={team.gameDay} /> : null}
        {team ? <ExportSquad teamName={team.name} players={squad} /> : null}
        {team ? (
          <AllocatePlayers
            teamId={team.id}
            teamLabel={`${team.ageGroup} · ${team.division ?? team.name}`}
          />
        ) : null}
      </div>
    );
  }

  const latest = evaluations.find((item) => item.playerId === selected.id);

  return (
    <div className="space-y-4" data-player-detail={selected.id}>
      <button
        type="button"
        onClick={() => setSelectedId("")}
        className="btn-quiet min-h-11 rounded-xl px-4 py-2 text-left"
      >
        <span className="block text-sm font-bold text-slate-950">Back to squad</span>
        <span className="mt-0.5 block text-xs font-medium text-slate-600">Return to the player list.</span>
      </button>
      <div className="space-y-4">
      <form
        className="rounded-xl bg-white p-4 ring-1 ring-slate-300"
        onSubmit={(event) => {
          event.preventDefault();
          addEvaluation({ playerId: selected.id, ...scores, notes });
          setHomework(selected.id, homework);
          setSaved(`Saved scores for ${selected.name}.`);
        }}
      >
        <div className="flex items-center gap-3">
          <PlayerPortrait photo={selected.photo} name={selected.name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">{selected.name}</h2>
            <p className="text-sm font-medium text-slate-600">
              {latest ? `Last rating ${latest.date}` : "No rating yet"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <ScoreRow label="Technical" value={scores.technical} onChange={(value) => setScores({ ...scores, technical: value })} />
          <ScoreRow label="Tactical" value={scores.tactical} onChange={(value) => setScores({ ...scores, tactical: value })} />
          <ScoreRow label="Physical" value={scores.physical} onChange={(value) => setScores({ ...scores, physical: value })} />
          <ScoreRow label="Mental" value={scores.mental} onChange={(value) => setScores({ ...scores, mental: value })} />
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Rating note
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-slate-800">
          Homework for the player
          <textarea
            value={homework}
            onChange={(event) => setHomeworkText(event.target.value)}
            className="mt-1 h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <Button type="submit" size="lg" className="mt-4 h-11 w-full">
          Save rating
        </Button>
        {saved ? <p className="mt-2 text-sm font-semibold text-emerald-800">{saved}</p> : null}
      </form>
        <form
          className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-300"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editName.trim()) return;
            updatePlayer(selected.id, {
              name: editName.trim(),
              squadNumber: Math.min(99, Math.max(1, editNumber || 1)),
              position: editRole,
              positions: editRoles,
            });
            setSaved(`Updated ${editName.trim()}.`);
            setConfirmDelete(false);
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Edit player</h3>
          <p className="text-sm font-medium text-slate-700">Change the name, shirt number, or position, then save.</p>
          <PlayerPhotoField
            photo={selected.photo}
            name={selected.name}
            field="squad-photo"
            onPhoto={(next) => setPlayerPhoto(selected.id, next)}
          />
          <label className="block text-sm font-semibold text-slate-800">
            Name
            <input
              value={editName}
              data-field="edit-name"
              onChange={(event) => setEditName(event.target.value)}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Squad number
            <input
              type="number"
              min={1}
              max={99}
              value={editNumber}
              data-field="edit-number"
              onChange={(event) => setEditNumber(Number(event.target.value))}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <PositionFields
            role={editRole}
            roles={editRoles}
            onRole={(next) => {
              setEditRole(next);
              if (next !== "All-rounder") setEditRoles([]);
            }}
            onToggle={(item) => setEditRoles((current) => (current.includes(item) ? current.filter((role) => role !== item) : [...current, item]))}
            field="edit-position"
          />
          <label className="block text-sm font-semibold text-slate-800">
            Team and league
            <select
              value={selected.teamId}
              data-field="edit-team"
              onChange={(event) => assignPlayer(selected.id, event.target.value)}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-base"
            >
              <option value="">Not on a team yet</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.ageGroup} · {item.division ?? item.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="lg" className="h-11 w-full">
            Save changes
          </Button>
        </form>
        <form
          className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-300"
          onSubmit={(event) => {
            event.preventDefault();
            if (!/^\d{4}$/.test(pin)) {
              setPinNotice("Use exactly 4 digits, or press Remove PIN.");
              return;
            }
            setPlayerPin(selected.id, pin);
            setPinNotice("PIN saved. The player needs it to open this profile.");
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Profile PIN</h3>
          <p className="text-sm font-medium text-slate-700">
            A 4-digit PIN keeps {selected.name}&apos;s ratings and feedback private from the rest of the squad.
          </p>
          <label className="block text-sm font-semibold text-slate-800">
            PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              data-field="profile-pin"
              placeholder="4 digits"
              onChange={(event) => {
                setPinValue(event.target.value.replace(/\D/g, "").slice(0, 4));
                setPinNotice("");
              }}
              className="mt-1 block h-11 w-40 rounded-md border border-slate-300 px-3 text-base tracking-[0.4em]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" className="h-11">
              Save PIN
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-11"
              onClick={() => {
                setPlayerPin(selected.id, "");
                setPinValue("");
                setPinNotice("PIN removed. Anyone on the device can open this profile.");
              }}
            >
              Remove PIN
            </Button>
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {selected.accessPin ? "This profile is PIN protected." : "No PIN set. The profile opens without one."}
          </p>
          {pinNotice ? <p className="text-sm font-semibold text-emerald-800">{pinNotice}</p> : null}
        </form>
        {confirmDelete ? (
          <div className="mt-3 rounded-lg bg-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-900">Remove {selected.name} from {team?.name ?? "this team"}?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                className="h-11"
                onClick={() => {
                  deletePlayer(selected.id);
                  setSelectedId("");
                  setConfirmDelete(false);
                  setSaved("");
                }}
              >
                Confirm delete
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-11" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="lg" variant="outline" className="mt-3 h-11 w-full" onClick={() => setConfirmDelete(true)}>
            Delete player
          </Button>
        )}
        <section className="rounded-xl bg-white ring-1 ring-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-bold text-slate-950">Training week {formatDay(weekStart)}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" variant="outline" className="h-11" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                Previous week
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-11" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next week
              </Button>
            </div>
          </div>
          <TrainingWeek playerId={selected.id} dates={dates} />
          <WeeklyReport key={`${selected.id}:${weekStart}`} playerId={selected.id} playerName={selected.name} teamId={selected.teamId} weekStart={weekStart} />
        </section>
      </div>
    </div>
  );
}

function GameDay({ teamId, teamName, gameDay }: { teamId: string; teamName: string; gameDay?: string }) {
  const setTeamGameDay = useClubStore((state) => state.setTeamGameDay);
  return (
    <form
      className="rounded-xl bg-white p-4 ring-1 ring-slate-300"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Game day</h2>
      <label className="mt-2 block text-sm font-semibold text-slate-800">
        Match day for {teamName}
        <input
          type="date"
          data-field="game-day"
          value={gameDay ?? ""}
          onChange={(event) => setTeamGameDay(teamId, event.target.value)}
          className="mt-1 block h-11 w-full max-w-xs rounded-md border border-slate-300 px-3 text-base"
        />
      </label>
      <p className="mt-2 text-sm font-semibold text-slate-800">
        {gameDay ? `Match day ${formatDay(gameDay)}.` : "No match day set yet."}
      </p>
    </form>
  );
}

function TrainingWeek({ playerId, dates }: { playerId: string; dates: string[] }) {
  const trainingMarks = useClubStore((state) => state.trainingMarks);
  const setTrainingAttendance = useClubStore((state) => state.setTrainingAttendance);
  return (
    <div className="space-y-2 border-t border-slate-200 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Training</p>
      <ul className="space-y-2">
        {dates.map((date) => {
          const mark = trainingMarks.find((item) => item.playerId === playerId && item.date === date);
          return (
            <li key={date} className="flex flex-wrap items-center justify-between gap-2" data-training-date={date} data-player-id={playerId}>
              <span className="text-sm font-semibold text-slate-900">{formatDay(date)}</span>
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={mark?.present === true}
                  onClick={() => setTrainingAttendance(playerId, date, true)}
                  className={`min-h-11 rounded-md px-3 text-sm font-bold ${
                    mark?.present === true ? "btn-shade" : "btn-quiet"
                  }`}
                >
                  Present
                </button>
                <button
                  type="button"
                  aria-pressed={mark?.present === false}
                  onClick={() => setTrainingAttendance(playerId, date, false)}
                  className={`min-h-11 rounded-md px-3 text-sm font-bold ${
                    mark?.present === false ? "btn-shade" : "btn-quiet"
                  }`}
                >
                  Not present
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WeeklyReport({
  playerId,
  playerName,
  teamId,
  weekStart,
}: {
  playerId: string;
  playerName: string;
  teamId: string;
  weekStart: string;
}) {
  const trainingMarks = useClubStore((state) => state.trainingMarks);
  const weeklyReports = useClubStore((state) => state.weeklyReports);
  const saveWeeklyReport = useClubStore((state) => state.saveWeeklyReport);
  const saved = weeklyReports.find((report) => report.playerId === playerId && report.weekStart === weekStart);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(saved?.gameFeedback ?? "");
  const [notice, setNotice] = useState("");
  const dates = weekDates(weekStart);

  return (
    <div className="border-t border-slate-200 px-4 py-3">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11"
        onClick={() => {
          setFeedback(saved?.gameFeedback ?? "");
          setOpen(true);
        }}
      >
        Weekly report
      </Button>
      {open ? (
        <div className="mt-3 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Week of {formatDay(weekStart)}
          </h3>
          <ul className="space-y-1 text-sm font-semibold text-slate-800">
            {dates.map((date) => {
              const mark = trainingMarks.find((item) => item.playerId === playerId && item.date === date);
              const status = mark ? (mark.present ? "Present" : "Not present") : "Not marked";
              return (
                <li key={date}>
                  {formatDay(date)}: {status}
                </li>
              );
            })}
          </ul>
          <label className="block text-sm font-semibold text-slate-800">
            Game feedback for {playerName}
            <textarea
              value={feedback}
              data-field="game-feedback"
              onChange={(event) => setFeedback(event.target.value)}
              className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </label>
          <Button
            type="button"
            size="lg"
            className="h-11"
            onClick={() => {
              if (!feedback.trim()) {
                setNotice("Write the game feedback before saving.");
                return;
              }
              saveWeeklyReport(playerId, teamId, weekStart, feedback);
              setNotice("Weekly report saved.");
            }}
          >
            Save weekly report
          </Button>
          {notice ? <p className="text-sm font-semibold text-slate-800">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ExportSquad({ teamName, players }: { teamName: string; players: ClubPlayer[] }) {
  function download() {
    const rows = [
      ["name", "squad number", "position"],
      ...players.map((player) => [player.name, String(player.squadNumber), formatPosition(player)]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const file = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${teamName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "team"}-players.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-300">
      <p className="text-sm font-semibold text-slate-800">
        {players.length === 0 ? `${teamName} has nobody to export yet.` : `${players.length} players in ${teamName}.`}
      </p>
      <Button type="button" size="lg" variant="outline" className="h-11" onClick={download}>
        Export players
      </Button>
    </div>
  );
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function AllocatePlayers({ teamId, teamLabel }: { teamId: string; teamLabel: string }) {
  const players = useClubStore((state) => state.players);
  const assignPlayer = useClubStore((state) => state.assignPlayer);
  const waiting = players
    .filter((player) => !player.teamId)
    .sort((a, b) => a.squadNumber - b.squadNumber || a.name.localeCompare(b.name));

  return (
    <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-allocate>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Allocate a player</h2>
      <p className="mt-1 text-sm font-medium text-slate-700">
        Players registered by the club who are not on a team yet. Allocating one puts them in {teamLabel}.
      </p>
      {waiting.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-800">Every registered player is on a team.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {waiting.map((player) => (
            <li key={player.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-950">
                    {player.squadNumber} {player.name}
                  </span>
                  <span className="block truncate text-sm text-slate-600">{formatPosition(player)}</span>
                </span>
              </span>
              <Button type="button" size="lg" className="h-11" onClick={() => assignPlayer(player.id, teamId)}>
                Allocate to this team
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`size-11 rounded-md text-sm font-bold ${score === value ? "btn-shade" : "btn-quiet"}`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
