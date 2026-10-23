"use client";

import { useState } from "react";

import { PlayerPortrait } from "@/components/club/player-photo";
import { PlayerRadar } from "@/components/dashboard/player-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ageLabel, sortByAge } from "@/lib/club/age";
import { formatPosition } from "@/lib/club/positions";
import type { ClubPlayer } from "@/lib/club/seed";
import { formatDay } from "@/lib/club/week";
import { useClubStore } from "@/stores/club-store";

function devicePlayerKey() {
  const clubKey = useClubStore.persist.getOptions().name ?? "bnfc-club-bnfc";
  return `${clubKey}-player`;
}

export function PlayerHome() {
  const players = useClubStore((state) => state.players);
  const ageGroups = useClubStore((state) => state.ageGroups);
  const evaluations = useClubStore((state) => state.evaluations);
  const attendance = useClubStore((state) => state.attendance);
  const weeklyReports = useClubStore((state) => state.weeklyReports);
  const [playerId, setPlayerId] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem(devicePlayerKey());
    if (!stored) return "";
    return useClubStore.getState().players.some((item) => item.id === stored) ? stored : "";
  });
  const [pickId, setPickId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const player = players.find((item) => item.id === playerId);
  const candidate = players.find((item) => item.id === pickId);
  const team = sortByAge(ageGroups)
    .flatMap((group) => group.teams.map((item) => ({ ...item, ageGroup: ageLabel(group.name) })))
    .find((item) => item.id === player?.teamId);
  const latest = evaluations.find((item) => item.playerId === player?.id);
  const mine = attendance.filter((item) => item.playerId === player?.id);
  const reports = weeklyReports
    .filter((report) => report.playerId === player?.id)
    .slice()
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  function openProfile(target: ClubPlayer) {
    if (target.accessPin && pin !== target.accessPin) {
      setError("That PIN does not match. Ask your coach.");
      return;
    }
    localStorage.setItem(devicePlayerKey(), target.id);
    setPlayerId(target.id);
    setPickId("");
    setPin("");
    setError("");
  }

  function lockProfile() {
    localStorage.removeItem(devicePlayerKey());
    setPlayerId("");
    setPickId("");
    setPin("");
    setError("");
  }

  if (players.length === 0) {
    return (
      <p className="rounded-lg bg-white px-4 py-3 font-semibold text-slate-800 ring-1 ring-slate-300">
        No players are on the club record yet.
      </p>
    );
  }

  if (!player) {
    return (
      <div className="space-y-4">
        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
          <label className="block text-sm font-semibold text-slate-800">
            Your name
            <select
              value={pickId}
              data-field="player-name"
              onChange={(event) => {
                setPickId(event.target.value);
                setPin("");
                setError("");
              }}
              className="mt-1 block h-11 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-base"
            >
              <option value="">Select your name</option>
              {players
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.squadNumber} {item.name}
                  </option>
                ))}
            </select>
          </label>
          {candidate ? (
            <div className="mt-3 space-y-3">
              {candidate.accessPin ? (
                <label className="block max-w-xs text-sm font-semibold text-slate-800">
                  PIN for {candidate.name}
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={pin}
                    data-field="player-pin"
                    onChange={(event) => {
                      setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                      setError("");
                    }}
                    className="mt-1 block h-11 w-40 rounded-md border border-slate-300 px-3 text-base tracking-[0.4em]"
                  />
                </label>
              ) : (
                <p className="text-sm font-medium text-slate-600">
                  This profile has no PIN yet. Your coach can add one to keep it private.
                </p>
              )}
              <Button type="button" size="lg" className="h-11" onClick={() => openProfile(candidate)}>
                Open my profile
              </Button>
              {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
            </div>
          ) : (
            <p className="mt-2 font-semibold text-slate-700">Choose your name to open your profile.</p>
          )}
        </section>
        <p className="text-sm font-medium text-slate-600">
          Ratings and coach feedback are private. Open only your own profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-300">
        <p className="text-sm font-semibold text-slate-800">
          Saved on this device as {player.name}. Ratings and feedback stay private.
        </p>
        <Button type="button" size="lg" variant="outline" className="h-11" onClick={lockProfile}>
          Lock profile
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <PlayerPortrait photo={player.photo} name={player.name} size="lg" />
            <CardTitle>{player.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Fact label="Squad" value={String(player.squadNumber)} />
          <Fact label="Position" value={formatPosition(player)} />
          <Fact label="Team" value={team?.name ?? "Squad"} />
          <Fact label="Age group" value={team?.ageGroup ?? "Youth"} />
          <p className="rounded-lg bg-slate-100 px-3 py-3 text-sm font-medium text-slate-800 sm:col-span-4">
            Homework: {player.homework || "Nothing assigned."}
          </p>
        </CardContent>
      </Card>
      {latest ? (
        <PlayerRadar
          playerName={player.name}
          scores={latest}
          caption={`Scores from ${latest.date}. Scale is 1 to 10.`}
        />
      ) : (
        <p className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300">
          No scores yet.
        </p>
      )}
      {latest?.notes ? (
        <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300">
          Coach note: {latest.notes}
        </p>
      ) : null}
      <section className="space-y-3" data-weekly="player">
        <h2 className="text-lg font-bold text-slate-950">Weekly report</h2>
        {reports.length === 0 ? (
          <p className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-300">
            No weekly report yet.
          </p>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle>Week of {formatDay(report.weekStart)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">
                  Game day: {report.gameDay ? formatDay(report.gameDay) : "Not set"}
                </p>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Training attendance</p>
                  <ul className="mt-1 space-y-1 text-sm font-semibold text-slate-900">
                    {report.attendance.map((day) => (
                      <li key={day.date}>
                        {formatDay(day.date)}: {day.status}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="rounded-lg bg-slate-100 px-3 py-3 text-sm font-medium text-slate-900" data-game-feedback>
                  {report.gameFeedback}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <p className="text-sm font-medium text-slate-600">No attendance yet.</p>
          ) : (
            <ul className="space-y-2">
              {mine.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-3">
                  <span>
                    <span className="block font-semibold text-slate-950">{item.detail}</span>
                    <span className="text-sm text-slate-600">{item.when}</span>
                  </span>
                  <Badge variant={item.status === "Present" ? "default" : "outline"}>{item.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
