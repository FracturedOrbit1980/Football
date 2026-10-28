"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes } from "react";

import { DrillBoard } from "@/components/drills/drill-board";
import { DrillMotionPreview } from "@/components/drills/drill-motion-preview";
import { DrillSetupDiagram } from "@/components/drills/drill-setup-diagram";
import { DrillStopwatch } from "@/components/drills/drill-stopwatch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DrillVideo } from "@/components/drills/drill-video";
import { YOUTH_AGES } from "@/lib/club/age";
import { emptyDrillBoard, type DrillBoard as DrillBoardState } from "@/lib/club/board";
import { SKILL_LEVELS, type SkillLevel } from "@/lib/club/catalog";
import { drillTypeLabel, momentLabel, plainDrillBlurb, playerCountLine, skillOf, youthAgeOf } from "@/lib/club/drill-record";
import type { ClubDrill } from "@/lib/club/seed";
import { useClubStore } from "@/stores/club-store";

export function DrillLibrary({
  showStopwatch = true,
  manageMode = false,
}: {
  showStopwatch?: boolean;
  manageMode?: boolean;
}) {
  const drills = useClubStore((state) => state.drills);
  const boards = useClubStore((state) => state.boards);
  const setDrillDuration = useClubStore((state) => state.setDrillDuration);
  const setDrillOfficial = useClubStore((state) => state.setDrillOfficial);
  const setDrillVideo = useClubStore((state) => state.setDrillVideo);
  const [youthAge, setYouthAge] = useState<(typeof YOUTH_AGES)[number]>(13);
  const [skill, setSkill] = useState<SkillLevel>("Beginner");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(drills[0]?.id ?? "");
  const query = search.trim().toLowerCase();

  const visible = drills.filter((drill) => {
    const ageOk = youthAgeOf(drill) === youthAge;
    const skillOk = skillOf(drill) === skill;
    const text = `${drill.title} ${drill.focus} ${drill.playerSetup} ${drill.constraint} ${drill.tags.join(" ")} ${drill.licenseLevel} ${drill.ageBand} ${drill.coachingPoints.join(" ")} ${drill.pitchSetup} ${drill.instructions} ${momentLabel(drill.moment)} ${drillTypeLabel(drill.drillType)} ${drill.level} U${youthAgeOf(drill)} ${skillOf(drill)}`.toLowerCase();
    return ageOk && skillOk && (!query || text.includes(query));
  });
  const selected = visible.find((drill) => drill.id === selectedId) ?? visible[0];

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-4 space-y-3">
        <label className="block text-sm font-semibold text-slate-800">
          Search drills
          <input
            value={search}
            data-field="drill-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, moment, or setup"
            className="mt-1 block h-11 w-full max-w-md rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Age group">
          {YOUTH_AGES.map((age) => (
            <FilterChip key={age} active={youthAge === age} onClick={() => setYouthAge(age)} data-age-group={age}>
              {`U${age}`}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Skill level">
          {SKILL_LEVELS.map((item) => (
            <FilterChip key={item} active={skill === item} onClick={() => setSkill(item)} data-skill-level={item}>
              {item}
            </FilterChip>
          ))}
        </div>
        <p className="text-sm font-semibold text-slate-700">{visible.length} drills in the club library</p>
      </div>
    <div className="grid min-w-0 max-w-full gap-6 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="order-2 min-w-0 lg:order-1">
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((drill) => {
            const active = selected?.id === drill.id;
            return (
              <div
                key={drill.id}
                data-drill-level={drill.level}
                data-moment={drill.moment}
                data-drill-type={drill.drillType}
                data-youth-age={youthAgeOf(drill)}
                data-skill-level={skillOf(drill)}
                className={`rounded-xl text-left ring-1 transition ${
                  active
                    ? "bg-emerald-50 ring-emerald-600"
                    : "bg-white ring-slate-300 hover:ring-slate-500"
                }`}
              >
                <button type="button" onClick={() => setSelectedId(drill.id)} className="w-full text-left">
                  <Card className="border-0 bg-transparent shadow-none ring-0">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>{drill.title}</CardTitle>
                        <Badge variant={drill.isClubOfficial ? "default" : "outline"}>
                          {drill.isClubOfficial ? "Official" : "Coach"}
                        </Badge>
                      </div>
                      <CardDescription className="text-slate-700" data-drill-blurb={drill.id}>
                        <span className="block">
                          {momentLabel(drill.moment)} · {drillTypeLabel(drill.drillType)} · {skillOf(drill)}
                        </span>
                        <span className="mt-1 block text-slate-800">{plainDrillBlurb(drill)}</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </button>
                <div className="flex items-center gap-3 px-4 pb-4 text-sm font-medium text-slate-800">
                  <DrillImage
                    drill={drill}
                    board={boards[drill.id]}
                    manageMode={manageMode}
                    size="sm"
                  />
                  <button type="button" onClick={() => setSelectedId(drill.id)} className="min-w-0 text-left">
                    {formatBlock(drill.durationSeconds)} · {drill.dimensions || drill.playerSetup}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected ? (
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>{selected.title}</CardTitle>
              <CardDescription className="text-slate-700">{selected.instructions}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-start gap-3">
              <DrillImage
                drill={selected}
                board={boards[selected.id]}
                manageMode={manageMode}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{momentLabel(selected.moment)} · {drillTypeLabel(selected.drillType)} · {selected.level}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{playerCountLine(selected.players)}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selected.dimensions || "Pitch size not set"} · {selected.workRest || "Work and rest not set"} · {selected.licenseLevel} · {selected.ageBand}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">{selected.equipment.length ? selected.equipment.join(", ") : "No equipment listed"}</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{selected.pitchSetup}</p>
                {manageMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-11"
                    onClick={() => setDrillOfficial(selected.id, !selected.isClubOfficial)}
                  >
                    {selected.isClubOfficial ? "Remove official flag" : "Mark as official"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <DrillVideo
            videoUrl={selected.videoUrl ?? ""}
            onAttach={(url, name) => setDrillVideo(selected.id, url, name)}
          />
          {manageMode ? null : (
            <DrillBoard
              drillId={selected.id}
              setup={selected.pitchSetup}
              durationSeconds={selected.durationSeconds}
            />
          )}
          {showStopwatch ? (
            <DrillStopwatch
              drillTitle={selected.title}
              targetSeconds={selected.durationSeconds}
              suggestedSeconds={selected.defaultDurationSeconds}
              onTargetSecondsChange={(seconds) => setDrillDuration(selected.id, seconds)}
            />
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Coaching points</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                {selected.coachingPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {selected.progressions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Progressions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {selected.progressions.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-white px-4 py-3 font-semibold text-slate-800 ring-1 ring-slate-300">
          No drills for this age and skill.
        </p>
      )}
    </div>
    </div>
  );
}

function canOpenSavedDrill(drill: ClubDrill, board: DrillBoardState | undefined) {
  if (!drill.isClubOfficial) return true;
  if (!board) return false;
  return board.frames.length > 1 || board.frames.some((frame) => frame.pieces.length > 0 || frame.marks.length > 0);
}

function DrillImage({
  drill,
  board,
  manageMode,
  size,
}: {
  drill: ClubDrill;
  board: DrillBoardState | undefined;
  manageMode: boolean;
  size: "sm" | "md";
}) {
  const preview = <DrillMotionPreview board={board ?? emptyDrillBoard()} size={size} />;
  if (manageMode || !canOpenSavedDrill(drill, board)) {
    return <DrillSetupDiagram diagram={drill.diagram} pitchSetup={drill.pitchSetup} size={size} />;
  }
  return (
    <Link
      href={`/coach/editor/?drill=${encodeURIComponent(drill.id)}`}
      aria-label={`Open ${drill.title} in the editor`}
      data-open-drill={drill.id}
      className="inline-flex shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      {preview}
    </Link>
  );
}

function formatBlock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function FilterChip({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      size="lg"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-11 px-4 text-base"
      {...rest}
    >
      {children}
    </Button>
  );
}
