"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FormationPitch,
  FORMATION_GROUPS,
  isFormationName,
  nextCustomFormationName,
  placeInSlots,
  placeOnPitch,
  type FormationName,
} from "@/components/match/formation-pitch";
import { TeamPicker, useCoachTeam } from "@/components/coach/team-picker";
import { DEFAULT_PITCH_COLOR } from "@/lib/club/board";
import { formatPosition, playsInGoal } from "@/lib/club/positions";
import { syncTeamToLite } from "@/lib/club/sync-lite";
import { useSyncState } from "@/lib/sync/engine";
import { cloudTeamFor, setTeamMapping, useTeamScope } from "@/lib/sync/team-scope";
import { useClubStore } from "@/stores/club-store";
import { useClubLibrary } from "@/stores/club-library";
import { useMatchStore, type PlayerMatchState, type SquadEntry } from "@/stores/match-store";

function formatClock(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function MatchReset({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
  }, [confirming]);

  return (
    <div className={confirming ? "w-full rounded-lg border border-slate-600 p-3 text-center" : ""}>
      <Button ref={resetButton} type="button" size="lg" variant="secondary" className="h-14 min-w-36 text-base"
        disabled={disabled} aria-expanded={confirming} onClick={() => setConfirming(true)}>
        <RotateCcw className="size-5" />
        Reset
      </Button>
      {confirming ? (
        <div role="group" aria-label="Confirm match reset" className="mt-3 space-y-3">
          <p>Start a new match? This clears the current clock, score, events and player minutes. Saved matches stay in your history.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button ref={cancelButton} type="button" variant="secondary" className="min-h-11" onClick={() => {
              setConfirming(false);
              resetButton.current?.focus();
            }}>Keep match</Button>
            <Button type="button" variant="destructive" className="min-h-11" onClick={onReset}>Start new match</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LiveMatchTracker() {
  const matchTimeSeconds = useMatchStore((state) => state.matchTimeSeconds);
  const isClockRunning = useMatchStore((state) => state.isClockRunning);
  const ourScore = useMatchStore((state) => state.ourScore);
  const theirScore = useMatchStore((state) => state.theirScore);
  const addGoal = useMatchStore((state) => state.addGoal);
  const formation = useMatchStore((state) => state.formation);
  const setFormation = useMatchStore((state) => state.setFormation);
  const layout = useMatchStore((state) => state.layout);
  const setLayout = useMatchStore((state) => state.setLayout);
  const storedPlayers = useMatchStore((state) => state.players);
  const matchId = useMatchStore((state) => state.matchId);
  const matchClubId = useMatchStore((state) => state.clubId);
  const matchTeamId = useMatchStore((state) => state.teamId);
  const recovered = useMatchStore((state) => state.recovered);
  const storageWarning = useMatchStore((state) => state.storageWarning);
  const opponent = useMatchStore((state) => state.opponent);
  const setOpponent = useMatchStore((state) => state.setOpponent);
  const clubId = useClubLibrary((state) => state.activeId);
  const startMatchClock = useMatchStore((state) => state.startMatchClock);
  const pauseMatchClock = useMatchStore((state) => state.pauseMatchClock);
  const substitutePlayer = useMatchStore((state) => state.substitutePlayer);
  const tickSecond = useMatchStore((state) => state.tickSecond);
  const resetMatch = useMatchStore((state) => state.resetMatch);
  const saveMatch = useClubStore((state) => state.saveMatch);
  const customFormations = useClubStore((state) => state.customFormations);
  const matchPitchColor = useClubStore((state) => state.matchPitchColor) || DEFAULT_PITCH_COLOR;
  const setMatchPitchColor = useClubStore((state) => state.setMatchPitchColor);
  const saveCustomFormation = useClubStore((state) => state.saveCustomFormation);
  const openMatch = useMatchStore((state) => state.openMatch);
  const clubPlayers = useClubStore((state) => state.players);
  const { team } = useCoachTeam();
  const [selectedOff, setSelectedOff] = useState<string | null>(null);
  const [selectedOn, setSelectedOn] = useState<string | null>(null);
  const [savedMatchId, setSavedMatchId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [formationName, setFormationName] = useState("Custom formation 1");
  const [nameTouched, setNameTouched] = useState(false);
  const [formationSaved, setFormationSaved] = useState(false);
  const shownName = nameTouched ? formationName : nextCustomFormationName(customFormations);
  const teamId = team?.id ?? "";
  const scopeMatches = Boolean(clubId && teamId && matchClubId === clubId && matchTeamId === teamId);
  const players = scopeMatches ? storedPlayers : [];
  const saved = scopeMatches && savedMatchId === matchId;
  const squadKey = clubPlayers
    .filter((player) => player.teamId === teamId)
    .map((player) => `${player.id}:${formatPosition(player)}`)
    .join("|");
  const teamName = team?.name ?? "Squad";
  const syncClubId = useSyncState((state) => state.clubId);
  const cloudTeams = useTeamScope((state) => state.teams);
  const scopeAdmin = useTeamScope((state) => state.isAdmin);
  useTeamScope((state) => state.map);
  const cloudTeamId = syncClubId && teamId ? cloudTeamFor(teamId, team?.name) : null;


  function selectedSquad(): SquadEntry[] {
    return clubPlayers.filter((player) => player.teamId === teamId)
      .sort((a, b) => a.squadNumber - b.squadNumber)
      .map((player, index) => ({ playerId: player.id, name: player.name,
        squadNumber: player.squadNumber, position: formatPosition(player),
        isOnPitch: index < 11, minutesPlayed: 0 }));
  }

  function isSelectedMatch() {
    const match = useMatchStore.getState();
    return Boolean(match.matchId && match.matchId === matchId && match.clubId === useClubLibrary.getState().activeId &&
      match.teamId === useClubStore.getState().coachTeamId);
  }

  useEffect(() => {
    const squad = clubPlayers.filter((player) => player.teamId === teamId)
      .sort((a, b) => a.squadNumber - b.squadNumber)
      .map((player, index) => ({ playerId: player.id, name: player.name,
        squadNumber: player.squadNumber, position: formatPosition(player),
        isOnPitch: index < 11, minutesPlayed: 0 }));
    openMatch(clubId ?? "", teamId, squad);
  }, [clubId, clubPlayers, openMatch, squadKey, teamId]);

  // Refresh timestamp-derived time; background/locked tabs do not lose elapsed time.
  useEffect(() => {
    if (!scopeMatches || !isClockRunning) return;
    const refresh = () => {
      const current = useMatchStore.getState();
      if (current.matchId === matchId && current.clubId === useClubLibrary.getState().activeId &&
        current.teamId === useClubStore.getState().coachTeamId) tickSecond();
    };
    refresh();
    const interval = setInterval(refresh, 500);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [isClockRunning, matchId, scopeMatches, tickSecond]);

  useEffect(() => () => useMatchStore.getState().pauseMatchClock(), []);

  const onPitch = players.filter((player) => player.isOnPitch);
  const bench = players.filter((player) => !player.isOnPitch);

  function choosePitch(playerId: string) {
    if (!isSelectedMatch()) return;
    if (selectedOn) {
      substitutePlayer(playerId, selectedOn);
      setSelectedOn(null);
      setSelectedOff(null);
      return;
    }
    setSelectedOff((current) => (current === playerId ? null : playerId));
  }

  function chooseBench(playerId: string) {
    if (!isSelectedMatch()) return;
    if (selectedOff) {
      substitutePlayer(selectedOff, playerId);
      setSelectedOff(null);
      setSelectedOn(null);
      return;
    }
    setSelectedOn((current) => (current === playerId ? null : playerId));
  }

  const emptyMessage = !team
    ? "Choose a team before kickoff."
    : players.length === 0
      ? `Add players to ${team.name} before kickoff.`
      : null;

  function presetPositions(name: FormationName) {
    return placeOnPitch(players, name).map(({ player, x, y }) => ({ playerId: player.playerId, x, y }));
  }

  function positionsFor(name: string, spots: { playerId: string; x: number; y: number }[] | null) {
    if (spots) return spots;
    const custom = customFormations.find((item) => item.id === name);
    if (custom) {
      return placeInSlots(players, custom.slots).map(({ player, x, y }) => ({ playerId: player.playerId, x, y }));
    }
    if (isFormationName(name)) return presetPositions(name);
    return [];
  }

  function chooseFormation(name: string) {
    if (!isSelectedMatch()) return;
    setFormation(name);
    setLayout(null);
    setFormationSaved(false);
  }

  function movePlayer(playerId: string, x: number, y: number) {
    if (!isSelectedMatch()) return;
    const base = layout ?? positionsFor(formation, null);
    setLayout(base.map((spot) => spot.playerId === playerId ? { playerId, x, y } : spot));
    setFormationSaved(false);
  }

  function saveFormation() {
    if (!isSelectedMatch()) return;
    const spots = positionsFor(formation, layout);
    const onPitchIds = players.filter((player) => player.isOnPitch);
    const keeper = onPitchIds.find((player) => playsInGoal(player.position));
    const rest = onPitchIds
      .filter((player) => player.playerId !== keeper?.playerId)
      .sort((a, b) => a.squadNumber - b.squadNumber);
    const ordered = keeper ? [keeper, ...rest] : rest;
    const byId = new Map(spots.map((spot) => [spot.playerId, spot]));
    const slots = ordered.flatMap((player) => {
      const spot = byId.get(player.playerId);
      return spot ? [{ x: spot.x, y: spot.y }] : [];
    });
    if (slots.length === 0) return;
    const id = saveCustomFormation(shownName, slots);
    setFormation(id);
    setLayout(null);
    setFormationName(shownName.trim() || "Custom formation 1");
    setNameTouched(true);
    setFormationSaved(true);
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <TeamPicker />
      {syncClubId && team ? (
        <div className="mb-6 rounded-2xl bg-white p-4 ring-1 ring-slate-300" data-club-team>
          <label className="block text-sm font-bold text-slate-900">
            Club team for this match
            <select
              className="mt-1 block h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-base"
              value={cloudTeamId ?? ""}
              onChange={(event) => setTeamMapping(teamId, event.target.value || null)}
            >
              <option value="">{scopeAdmin ? "Unassigned (admin only)" : "Choose your team…"}</option>
              {cloudTeams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {!cloudTeamId ? (
            <p className="mt-2 text-sm font-semibold text-amber-800">
              {cloudTeams.length === 0
                ? "You are not assigned to a club team yet, so matches stay on this device. Ask a club admin to add you to a team."
                : scopeAdmin
                  ? "Saved matches without a team are flagged as unassigned for admins."
                  : "Matches stay on this device until you choose one of your club teams."}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="match-stage min-w-0">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="mb-2 space-y-2" aria-label="Formations">
            <p className="text-xs font-semibold text-slate-600">Goalkeeper included in every shape.</p>
            {FORMATION_GROUPS.map((group) => (
              <div key={group.id} data-formation-group={group.id}>
                <p className="text-xs font-bold text-slate-800">{group.label}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {group.formations.map((name) => (
                    <button
                      key={name}
                      type="button"
                      data-formation={name}
                      onClick={() => chooseFormation(name)}
                      className={`min-h-11 rounded-md px-3 text-sm font-bold ${
                        formation === name ? "btn-shade" : "btn-quiet"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {customFormations.length > 0 ? (
              <div data-formation-group="custom">
                <p className="text-xs font-bold text-slate-800">Saved</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {customFormations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-formation={item.name}
                      onClick={() => chooseFormation(item.id)}
                      className={`min-h-11 rounded-md px-3 text-sm font-bold ${
                        formation === item.id ? "btn-shade" : "btn-quiet"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1">
            <label className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-950">
              Field
              <input
                type="color"
                aria-label="Match field colour"
                data-field="match-pitch-color"
                value={matchPitchColor}
                onChange={(event) => setMatchPitchColor(event.target.value)}
                className="size-11 cursor-pointer rounded-md border border-slate-300 bg-transparent p-0.5"
              />
            </label>
            <FormationPitch
              formation={formation}
              players={players}
              emptyMessage={emptyMessage}
              positions={layout ?? (isFormationName(formation) ? undefined : positionsFor(formation, null))}
              onMove={movePlayer}
              fieldColor={matchPitchColor}
            />
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-[12rem] flex-1 text-sm font-semibold text-slate-800">
                Formation name
                <input
                  data-field="formation-name"
                  value={shownName}
                  onChange={(event) => {
                    setNameTouched(true);
                    setFormationName(event.target.value);
                    setFormationSaved(false);
                  }}
                  className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950"
                />
              </label>
              <button
                type="button"
                data-formation-save
                onClick={saveFormation}
                disabled={players.every((player) => !player.isOnPitch)}
                className="btn-shade min-h-11 rounded-md px-4 text-sm font-bold"
              >
                Save
              </button>
            </div>
            {formationSaved ? (
              <p data-formation-saved role="status" className="mt-2 text-sm font-bold text-emerald-800">
                Saved
              </p>
            ) : null}
          </div>
        </div>
      <section data-match-id={scopeMatches ? matchId : ""} data-match-team={teamId} data-match-club={clubId ?? ""} className="match-clock ink-panel mt-4 min-w-0 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">{teamName}</p>
          <p className="btn-shade rounded-full px-3 py-1 text-sm font-bold">
            {scopeMatches && isClockRunning ? "LIVE" : "READY"}
          </p>
        </div>
        <p data-match-clock={scopeMatches ? matchTimeSeconds : 0} className="my-4 text-center font-mono text-5xl tracking-wider text-emerald-400">
          {formatClock(scopeMatches ? matchTimeSeconds : 0)}
        </p>
        <div className="mb-3 flex items-center justify-center gap-3" aria-label="Score">
          <ScoreControl label={teamName} value={scopeMatches ? ourScore : 0} onChange={(delta) => { if (isSelectedMatch()) addGoal("for", delta); }} />
          <span className="text-2xl font-black">–</span>
          <ScoreControl label={opponent.trim() || "Opposition"} value={scopeMatches ? theirScore : 0} onChange={(delta) => { if (isSelectedMatch()) addGoal("against", delta); }} />
        </div>
        <label className="mb-3 block text-sm font-semibold text-emerald-100">
          Opponent
          <input
            value={scopeMatches ? opponent : ""}
            disabled={!scopeMatches}
            onChange={(event) => {
              if (!isSelectedMatch()) return;
              setOpponent(event.target.value);
              setSavedMatchId("");
              setSaveError("");
            }}
            placeholder="Opposition"
            className="mt-1 block h-11 w-full max-w-full rounded-md border border-slate-600 bg-slate-800 px-3 text-base text-white"
          />
        </label>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            size="lg"
            className="h-14 min-w-36 text-base"
            disabled={!scopeMatches || players.length === 0}
            onClick={() => {
              if (!isSelectedMatch()) return;
              if (isClockRunning) pauseMatchClock(); else startMatchClock();
            }}
          >
            {isClockRunning ? <Pause className="size-5" /> : <Play className="size-5" />}
            {isClockRunning ? "Pause" : "Start"}
          </Button>
          <MatchReset
            key={JSON.stringify([clubId, teamId, matchId])}
            disabled={!scopeMatches || !matchId}
            onReset={() => {
              if (!isSelectedMatch()) return;
              resetMatch(selectedSquad());
              setSavedMatchId("");
              setSaveError("");
              setLayout(null);
              setSelectedOff(null);
              setSelectedOn(null);
            }}
          />
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-14 min-w-36 text-base"
            disabled={!scopeMatches || players.length === 0 || opponent.trim().length === 0}
            onClick={() => {
              if (!team || !clubId || !isSelectedMatch()) return;
              tickSecond();
              const current = useMatchStore.getState();
              const accepted = saveMatch(
                current.matchId,
                clubId,
                team.id,
                current.opponent.trim(),
                current.players.map((player) => ({
                  playerId: player.playerId,
                  minutesPlayed: player.minutesPlayed,
                })),
                {
                  formation: customFormations.find((item) => item.id === current.formation)?.name ?? current.formation,
                  durationSeconds: current.matchTimeSeconds, ourScore: current.ourScore, theirScore: current.theirScore,
                  events: current.events, layout: current.layout, teamLabel: team.name,
                  cloudTeamId: cloudTeamId ?? undefined,
                  players: current.players.map((player) => ({ playerId: player.playerId, name: player.name,
                    squadNumber: player.squadNumber, position: player.position, startedOnPitch: player.startedOnPitch })),
                },
              );
              setSavedMatchId(accepted ? current.matchId : "");
              setSaveError(accepted ? "" : "Minutes were not saved because the club, team or player allocation changed. Check the squad before saving again.");
            }}
          >
            Save minutes
          </Button>
        </div>
        {scopeMatches && recovered ? <p role="status" className="mt-3 text-sm text-emerald-200">Recovered this team&apos;s match, paused. Press Start when you are ready.</p> : null}
        {storageWarning ? <p role="status" className="mt-3 text-sm text-amber-200">{storageWarning}</p> : null}
        {saveError ? <p role="alert" className="mt-3 text-sm text-amber-200">{saveError}</p> : null}
        <p className="mt-3 text-center text-sm font-medium text-slate-300">
          {emptyMessage ? `${emptyMessage} ` : null}
          {saved ? "Minutes saved. Saving again updates this match. Players with time on the pitch are marked present." : null}{" "}
          Tap a player on the pitch, then a bench player, to substitute. Minutes accrue only while the clock runs.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3">
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-emerald-400">Pitch-side Match Engine</span>
            <span className="block text-xs text-slate-300">Run the live touchline clock, pitch substitutions, or match events</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/lite/`}
              onClick={() => {
                if (!team) return;
                syncTeamToLite(
                  { id: team.id, name: team.name },
                  clubPlayers.filter((p) => p.teamId === team.id).map((p) => ({
                    id: p.id,
                    name: p.name,
                    squadNumber: p.squadNumber,
                    position: formatPosition(p),
                    photo: p.photo,
                  })),
                );
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-400 px-3 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-teal-300 active:scale-95 shadow-sm"
            >
              ⚡ Pitch-side Lite
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/pro/`}
              onClick={() => {
                if (!team) return;
                syncTeamToLite(
                  { id: team.id, name: team.name },
                  clubPlayers.filter((p) => p.teamId === team.id).map((p) => ({
                    id: p.id,
                    name: p.name,
                    squadNumber: p.squadNumber,
                    position: formatPosition(p),
                    photo: p.photo,
                  })),
                );
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/20 px-3 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400/30 active:scale-95 shadow-sm"
            >
              ⭐ Pro Tracker
            </a>
          </div>
        </div>
      </section>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <PlayerColumn
          title={`On pitch (${onPitch.length})`}
          players={onPitch}
          selectedId={selectedOff}
          onSelect={choosePitch}
        />
        <PlayerColumn
          title={`Bench (${bench.length})`}
          players={bench}
          selectedId={selectedOn}
          onSelect={chooseBench}
        />
      </div>
    </div>
  );
}

function PlayerColumn({
  title,
  players,
  selectedId,
  onSelect,
}: {
  title: string;
  players: PlayerMatchState[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
}) {
  return (
    <section className="rounded-xl bg-white p-3 ring-1 ring-slate-300">
      <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      <ul className="mt-2 space-y-2">
        {players.map((player) => {
          const selected = player.playerId === selectedId;
          return (
            <li key={player.playerId}>
              <button
                type="button"
                data-match-player={player.playerId}
                data-player-minutes={player.minutesPlayed}
                onClick={() => onSelect(player.playerId)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${
                  selected ? "btn-shade" : "btn-quiet"
                }`}
              >
                <span className="w-8 text-lg font-bold tabular-nums">{player.squadNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{player.name}</span>
                  <span className={`block text-sm font-medium ${selected ? "opacity-80" : "text-slate-600"}`}>
                    {player.position}
                  </span>
                </span>
                <span className="text-right text-sm font-bold tabular-nums">
                  {player.minutesPlayed.toFixed(1)}
                  <span className="ml-1 font-semibold">min</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScoreControl({ label, value, onChange }: { label: string; value: number; onChange: (delta: 1 | -1) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-28 truncate text-xs font-semibold text-slate-300">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`${label} goal removed`} onClick={() => onChange(-1)} className="btn-quiet size-11 rounded-md text-lg font-bold">
          −
        </button>
        <span className="w-10 text-center font-mono text-3xl font-bold tabular-nums" data-score>
          {value}
        </span>
        <button type="button" aria-label={`${label} goal`} onClick={() => onChange(1)} className="btn-shade size-11 rounded-md text-lg font-bold">
          +
        </button>
      </div>
    </div>
  );
}
