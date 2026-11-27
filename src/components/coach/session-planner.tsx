"use client";

import { useState } from "react";

import { DrillBoard } from "@/components/drills/drill-board";
import { DrillStopwatch } from "@/components/drills/drill-stopwatch";
import { Button } from "@/components/ui/button";
import { useCoachTeam } from "@/components/coach/team-picker";
import { formatDate } from "@/lib/club/week";
import { useClubStore } from "@/stores/club-store";

const RESULTS_PER_PAGE = 12;

export function SessionPlanner() {
  const drills = useClubStore((state) => state.drills);
  const sessions = useClubStore((state) => state.sessions);
  const saveSession = useClubStore((state) => state.saveSession);
  const setDrillDuration = useClubStore((state) => state.setDrillDuration);
  const { team } = useCoachTeam();
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [resultLimit, setResultLimit] = useState(RESULTS_PER_PAGE);
  const [saved, setSaved] = useState(false);

  const chosen = picked
    .map((id) => drills.find((drill) => drill.id === id))
    .filter((drill) => drill !== undefined);
  const totalSeconds = chosen.reduce((sum, drill) => sum + drill.durationSeconds, 0);
  const active = chosen.find((drill) => drill.id === activeId) ?? chosen[0];
  const search = query.trim().toLowerCase();
  const matches = search ? drills.filter((drill) =>
    [drill.title, drill.focus, drill.playerSetup].some((field) => field.toLowerCase().includes(search))
  ) : [];

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id];
    });
    if (!picked.includes(id)) setActiveId(id);
    setSaved(false);
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <h2 className="mb-3 text-lg font-bold">Session planner</h2>
        <label className="block text-sm font-semibold">
          Find a drill
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResultLimit(RESULTS_PER_PAGE);
            }}
            placeholder="Search by name, focus or setup"
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        {search ? (
          <div role="group" aria-label="Matching drills" className="mt-2 space-y-2">
            {matches.length === 0 ? <p role="status" className="text-sm">No matching drills.</p> : null}
            {matches.slice(0, resultLimit).map((drill) => (
              <button
                key={drill.id}
                type="button"
                aria-pressed={picked.includes(drill.id)}
                onClick={() => toggle(drill.id)}
                className={`block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${picked.includes(drill.id) ? "btn-shade" : "btn-quiet"}`}
              >
                {drill.title}
              </button>
            ))}
            {matches.length > resultLimit ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setResultLimit(resultLimit + RESULTS_PER_PAGE)}>
                Show more drills
              </Button>
            ) : null}
          </div>
        ) : null}
        {chosen.length > 0 ? (
          <ol aria-label="Drills in session" className="mt-4 list-decimal space-y-1 pl-6">
            {chosen.map((drill) => (
              <li key={drill.id}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setActiveId(drill.id)} aria-pressed={active?.id === drill.id} className="min-h-11 text-left text-sm font-semibold">
                    {drill.title}
                  </button>
                  <Button type="button" variant="outline" aria-label={`Remove ${drill.title}`} className="min-h-11" onClick={() => toggle(drill.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || picked.length === 0 || !team) return;
            saveSession(team.id, title.trim(), picked);
            setSaved(true);
          }}
        >
          <label className="text-sm font-semibold text-slate-800">
            Session name
            <input value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} className="mt-1 block h-11 rounded-md border border-slate-300 px-3 text-base" />
          </label>
          <Button type="submit" size="lg" className="h-11" disabled={!team || !chosen.length || !title.trim()}>
            Save plan
          </Button>
          <p className="text-sm font-semibold text-slate-700">{Math.round(totalSeconds / 60)} min planned</p>
          {saved ? <p className="text-sm font-semibold text-emerald-800">Plan saved.</p> : null}
        </form>
        <ul className="mt-4 space-y-2">
          {sessions
            .filter((session) => session.teamId === team?.id)
            .map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(session.drillIds);
                    setQuery("");
                    setResultLimit(RESULTS_PER_PAGE);
                    setSaved(false);
                    setTitle(session.title);
                    setActiveId(session.drillIds[0] ?? "");
                  }}
                  className="w-full rounded-lg bg-white px-3 py-3 text-left ring-1 ring-slate-300"
                >
                  <span className="block font-semibold text-slate-950">{session.title}</span>
                  <span className="text-sm text-slate-600">
                    {formatDate(session.savedOn)} · {session.drillIds.length} drills
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
      {active ? (
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <DrillBoard drillId={active.id} setup={active.pitchSetup} durationSeconds={active.durationSeconds} />
          <DrillStopwatch
            drillTitle={active.title}
            targetSeconds={active.durationSeconds}
            suggestedSeconds={active.defaultDurationSeconds}
            onTargetSecondsChange={(seconds) => setDrillDuration(active.id, seconds)}
          />
        </div>
      ) : null}
    </div>
  );
}
