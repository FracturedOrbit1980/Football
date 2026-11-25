"use client";

import { useState } from "react";

import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { DIVISIONS, isDivision } from "@/lib/club/catalog";
import { useClubStore } from "@/stores/club-store";

export function useCoachTeam() {
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const coachTeamId = useClubStore((state) => state.coachTeamId);
  const setCoachTeam = useClubStore((state) => state.setCoachTeam);
  const teams = ageGroups.flatMap((group) =>
    group.teams.map((team) => ({ ...team, ageGroup: ageLabel(group.name), ageGroupId: group.id })),
  );
  const team = teams.find((item) => item.id === coachTeamId) ?? null;
  return { ageGroups, teams, team, setCoachTeam };
}

export function TeamPicker() {
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const coachTeamId = useClubStore((state) => state.coachTeamId);
  const openDivisionTeam = useClubStore((state) => state.openDivisionTeam);
  const setCoachTeam = useClubStore((state) => state.setCoachTeam);
  const [ageId, setAgeId] = useState("");
  const selected =
    ageGroups.find((group) => group.id === ageId) ??
    ageGroups.find((group) => group.teams.some((team) => team.id === coachTeamId)) ??
    null;
  const openTeam = selected?.teams.find((team) => team.id === coachTeamId);
  const divisionValue = openTeam?.division ?? "";

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-300" data-team-setup>
      <p className="text-sm font-semibold text-slate-800">Age group</p>
      <div
        className="mt-3 flex flex-wrap gap-3"
        data-age-order={ageGroups.map((group) => ageLabel(group.name)).join(" ")}
      >
        {ageGroups.map((group) => {
          const label = ageLabel(group.name);
          const active = group.id === selected?.id;
          return (
            <button
              key={group.id}
              type="button"
              data-age-tile={label}
              aria-pressed={active}
              onClick={() => setAgeId(group.id)}
              className={`min-h-12 min-w-16 rounded-xl px-4 text-base font-black ${active ? "btn-shade" : "btn-quiet"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {selected ? (
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Division
          <select
            value={divisionValue}
            data-field="division"
            onChange={(event) => {
              if (!isDivision(event.target.value)) return;
              openDivisionTeam(selected.id, event.target.value);
            }}
            className={`mt-1 block h-11 w-full max-w-xs rounded-md px-3 text-base font-bold ${divisionValue ? "btn-shade" : "btn-quiet"}`}
          >
            {divisionValue === "" ? (
              <option value="" hidden>
                Division
              </option>
            ) : null}
            {DIVISIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-3 text-sm font-medium text-slate-600">Tap an age group, then assign the division.</p>
      )}
      {selected && selected.teams.some((team) => !team.division) ? (
        <div className="mt-4" data-named-teams>
          <p className="text-sm font-semibold text-slate-800">Club teams</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.teams
              .filter((team) => !team.division)
              .map((team) => (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={team.id === coachTeamId}
                  onClick={() => setCoachTeam(team.id)}
                  className={`min-h-11 rounded-xl px-4 text-sm font-black ${team.id === coachTeamId ? "btn-shade" : "btn-quiet"}`}
                >
                  {team.name}
                </button>
              ))}
          </div>
        </div>
      ) : null}
      {openTeam ? (
        <p data-open-team={openTeam.id} className="mt-3 text-sm font-semibold text-slate-950">
          Open team: {ageLabel(selected?.name ?? "")} · {openTeam.division ?? openTeam.name}
        </p>
      ) : selected ? (
        <p className="mt-3 text-sm font-medium text-slate-600">Choose a division to open the team.</p>
      ) : null}
    </div>
  );
}
