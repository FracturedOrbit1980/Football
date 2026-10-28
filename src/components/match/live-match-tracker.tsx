"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

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
import { ConfirmBar } from "@/components/layout/confirm-bar";
import { DEFAULT_PITCH_COLOR } from "@/lib/club/board";
import { formatPosition, playsInGoal } from "@/lib/club/positions";
import { useClubStore } from "@/stores/club-store";
import { useMatchStore, type PlayerMatchState } from "@/stores/match-store";

function formatClock(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function LiveMatchTracker() {
  const matchTimeSeconds = useMatchStore((state) => state.matchTimeSeconds);
  const isClockRunning = useMatchStore((state) => state.isClockRunning);
  const players = useMatchStore((state) => state.players);
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
  const loadSquad = useMatchStore((state) => state.loadSquad);
  const clubPlayers = useClubStore((state) => state.players);
  const { team } = useCoachTeam();
  const [selectedOff, setSelectedOff] = useState<string | null>(null);
  const [selectedOn, setSelectedOn] = useState<string | null>(null);
  const [opponent, setOpponent] = useState("");
  const [saved, setSaved] = useState(false);
  const [formation, setFormation] = useState<string>("4-4-2");
  const [layout, setLayout] = useState<{ playerId: string; x: number; y: number }[] | null>(null);
  const [formationName, setFormationName] = useState("Custom formation 1");
  const [nameTouched, setNameTouched] = useState(false);
  const [formationSaved, setFormationSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const shownName = nameTouched ? formationName : nextCustomFormationName(customFormations);
  const teamId = team?.id ?? "";
  const squadKey = clubPlayers
    .filter((player) => player.teamId === teamId)
    .map((player) => `${player.id}:${formatPosition(player)}`)
    .join("|");
  const teamName = team?.name ?? "Squad";

  useEffect(() => {
    if (!teamId || isClockRunning || matchTimeSeconds > 0) return;
    const squad = clubPlayers
      .filter((player) => player.teamId === teamId)
      .sort((a, b) => a.squadNumber - b.squadNumber)
      .map((player, index) => ({
        playerId: player.id,
        name: player.name,
        squadNumber: player.squadNumber,
        position: formatPosition(player),
        isOnPitch: index < 11,
        minutesPlayed: 0,
      }));
    const current = useMatchStore.getState().players.map((player) => `${player.playerId}:${player.position}`).join("|");
    const next = squad.map((player) => `${player.playerId}:${player.position}`).join("|");
    if (current === next) return;
    loadSquad(squad);
  }, [clubPlayers, isClockRunning, loadSquad, matchTimeSeconds, squadKey, teamId]);

  useEffect(() => {
    if (!isClockRunning) return;
    const interval = setInterval(() => tickSecond(), 1000);
    return () => clearInterval(interval);
  }, [isClockRunning, tickSecond]);

  const onPitch = players.filter((player) => player.isOnPitch);
  const bench = players.filter((player) => !player.isOnPitch);

  function choosePitch(playerId: string) {
    if (selectedOn) {
      substitutePlayer(playerId, selectedOn);
      setSelectedOn(null);
      setSelectedOff(null);
      return;
    }
    setSelectedOff((current) => (current === playerId ? null : playerId));
  }

  function chooseBench(playerId: string) {
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
    setFormation(name);
    setLayout(null);
    setFormationSaved(false);
  }

  function movePlayer(playerId: string, x: number, y: number) {
    setLayout((current) => {
      const base = current ?? positionsFor(formation, null);
      return base.map((spot) => (spot.playerId === playerId ? { playerId, x, y } : spot));
    });
    setFormationSaved(false);
  }

  function saveFormation() {
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
      <section className="match-clock ink-panel mt-4 min-w-0 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">{teamName}</p>
          <p className="btn-shade rounded-full px-3 py-1 text-sm font-bold">
            {isClockRunning ? "LIVE" : "READY"}
          </p>
        </div>
        <p className="my-4 text-center font-mono text-5xl tracking-wider text-emerald-400">
          {formatClock(matchTimeSeconds)}
        </p>
        <label className="mb-3 block text-sm font-semibold text-emerald-100">
          Opponent
          <input
            value={opponent}
            onChange={(event) => {
              setOpponent(event.target.value);
              setSaved(false);
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
            onClick={() => (isClockRunning ? pauseMatchClock() : startMatchClock())}
          >
            {isClockRunning ? <Pause className="size-5" /> : <Play className="size-5" />}
            {isClockRunning ? "Pause" : "Start"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-14 min-w-36 text-base"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="size-5" />
            Reset
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-14 min-w-36 text-base"
            disabled={players.length === 0 || opponent.trim().length === 0}
            onClick={() => {
              if (!team) return;
              saveMatch(
                team.id,
                opponent.trim(),
                players.map((player) => ({
                  playerId: player.playerId,
                  minutesPlayed: player.minutesPlayed,
                })),
              );
              setSaved(true);
            }}
          >
            Save minutes
          </Button>
        </div>
        {confirmReset ? (
          <ConfirmBar
            message="Reset the clock and the minutes counted in this match? Who is on the pitch stays as it is."
            confirmLabel="Reset minutes"
            cancelLabel="Keep minutes"
            onConfirm={() => {
              resetMatch();
              setSelectedOff(null);
              setSelectedOn(null);
              setConfirmReset(false);
              setSaved(false);
            }}
            onCancel={() => setConfirmReset(false)}
          />
        ) : null}
        <p className="mt-3 text-center text-sm font-medium text-slate-300">
          {emptyMessage ? `${emptyMessage} ` : null}
          {saved ? "Minutes saved. Players with time on the pitch are marked present." : null}{" "}
          Tap a player on the pitch, then a bench player, to substitute. Minutes accrue only while the clock runs.
        </p>
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
