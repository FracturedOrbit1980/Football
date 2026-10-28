"use client";

import Link from "next/link";
import { useState } from "react";

import { useRole } from "@/components/auth/role-session";
import { ConfirmBar } from "@/components/layout/confirm-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamPicker } from "@/components/coach/team-picker";
import { rand } from "@/lib/club/accounting";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { readClubAccountSummary } from "@/lib/club/overview";
import { useClubStore } from "@/stores/club-store";
import { useClubLibrary } from "@/stores/club-library";

export function ClubOverview() {
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const players = useClubStore((state) => state.players);
  const drills = useClubStore((state) => state.drills);
  const resetClub = useClubStore((state) => state.resetClub);
  const clubKind = useClubStore((state) => state.clubKind);
  const [confirmReset, setConfirmReset] = useState(false);
  const clubs = useClubLibrary((state) => state.clubs);
  const activeId = useClubLibrary((state) => state.activeId);
  const load = useClubLibrary((state) => state.load);
  const { role } = useRole();
  const canSeeAllClubs = role === "DEVELOPER";
  const current = clubs.find((club) => club.id === activeId) ?? null;
  const teamCount = ageGroups.reduce((sum, group) => sum + group.teams.length, 0);

  const stats = [
    { label: "Age groups", value: String(ageGroups.length) },
    { label: "Teams", value: String(teamCount) },
    { label: "Players", value: String(players.length) },
    { label: "Official drills", value: String(drills.filter((drill) => drill.isClubOfficial).length) },
  ];

  return (
    <div>
      {canSeeAllClubs ? (
      <Card data-registered-clubs>
        <CardHeader>
          <CardTitle className="text-lg font-black text-slate-950">Registered clubs</CardTitle>
          <p className="text-sm font-medium text-slate-600">
            Every club on this device, with its registered players and fee balance.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {clubs.map((club) => {
              const summary = readClubAccountSummary(club);
              const isActive = club.id === activeId;
              const open = () => {
                if (!isActive) void load(club.id);
              };
              return (
                <li
                  key={club.id}
                  data-club-row={club.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-slate-100 px-3 py-3 ring-1 ring-slate-200"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white"
                  >
                    {club.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-black text-slate-950">{club.name}</span>
                      {isActive ? (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          Open now
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold text-slate-600" data-club-players={summary.players}>
                      {summary.players} registered
                    </span>
                  </span>
                  <span className="grid w-24 shrink-0 gap-0.5">
                    <span className="text-xs font-medium text-slate-600">Received</span>
                    <span className="text-base font-bold text-slate-950" data-club-received={summary.received}>
                      {rand(summary.received)}
                    </span>
                  </span>
                  <span className="grid w-28 shrink-0 gap-0.5">
                    <span className="text-xs font-medium text-slate-600">Outstanding</span>
                    <span
                      className={`text-base font-bold ${summary.outstanding > 0 ? "text-rose-700" : "text-slate-950"}`}
                      data-club-outstanding={summary.outstanding}
                    >
                      {rand(summary.outstanding)}
                    </span>
                  </span>
                  <span className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {isActive ? null : (
                      <button
                        type="button"
                        data-open-club={club.id}
                        onClick={open}
                        className="btn-shade inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold"
                      >
                        Open
                      </button>
                    )}
                    <Link
                      href="/admin/people"
                      data-club-players-link={club.id}
                      onClick={open}
                      className="btn-quiet inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold"
                    >
                      Players
                    </Link>
                    <Link
                      href="/admin/accounting"
                      data-club-account-link={club.id}
                      onClick={open}
                      className="btn-quiet inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold"
                    >
                      Account
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      ) : null}
      <h2 className={`text-lg font-black text-slate-950 ${canSeeAllClubs ? "mt-8" : ""}`}>
        {canSeeAllClubs ? "Current club" : "Your club"}{current ? ` · ${current.name}` : ""}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-600">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-slate-950">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <TeamPicker />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ageGroups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle data-age-group={ageLabel(group.name)}>{ageLabel(group.name)}</CardTitle>
            </CardHeader>
            <CardContent>
              {group.teams.length === 0 ? (
                <p className="text-sm font-medium text-slate-600">Choose a division to open a team.</p>
              ) : (
                <ul className="space-y-2">
                  {group.teams.map((team) => (
                    <li key={team.id} className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-950">
                      {team.division ?? team.name}
                      <span className="ml-2 text-sm font-medium text-slate-600">
                        {players.filter((player) => player.teamId === team.id).length} players
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {confirmReset ? (
        <ConfirmBar
          message={
            clubKind === "custom"
              ? "Replace this club's players, fees, drills, and attendance with a fresh official drill library? Players on this device are removed."
              : "Replace this club's squad, fees, drills, and attendance with the official Clubstride library?"
          }
          confirmLabel="Restore library"
          cancelLabel="Keep current records"
          onConfirm={() => {
            resetClub();
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="lg" className="mt-4 h-11" onClick={() => setConfirmReset(true)}>
          Restore official library
        </Button>
      )}
    </div>
  );
}
