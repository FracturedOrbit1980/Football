"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import { MannequinFigure } from "@/components/pitch/mannequin-figure";
import { DEFAULT_PITCH_COLOR, DEFAULT_PLAYER_COLOR } from "@/lib/club/board";
import { playsInGoal } from "@/lib/club/positions";
import type { CustomFormation } from "@/lib/club/seed";
import type { PlayerMatchState } from "@/stores/match-store";
import { PitchWatermark } from "@/components/cloud/branding";

export const FORMATIONS = [
  "2-2",
  "1-2-1",
  "2-1-1",
  "2-3-1",
  "3-2-1",
  "3-1-2",
  "3-3-2",
  "3-2-3",
  "2-3-3",
  "4-4-2",
  "4-3-3",
  "3-5-2",
] as const;

export type FormationName = (typeof FORMATIONS)[number];

export const FORMATION_GROUPS: {
  id: string;
  label: string;
  formations: FormationName[];
}[] = [
  { id: "eleven", label: "11-a-side", formations: ["4-4-2", "4-3-3", "3-5-2"] },
  { id: "u10-u11", label: "U10 and U11 · 9-a-side", formations: ["3-3-2", "3-2-3", "2-3-3"] },
  { id: "u8-u9", label: "U8 and U9 · 7-a-side", formations: ["2-3-1", "3-2-1", "3-1-2"] },
  { id: "u6-u7", label: "U6 and U7 · 5-a-side", formations: ["2-2", "1-2-1", "2-1-1"] },
];

const KEEPER = { x: 10, y: 32 };

function outfieldLine(count: number, x: number) {
  const lanes: Record<number, number[]> = {
    1: [32],
    2: [20, 44],
    3: [12, 32, 52],
  };
  return lanes[count].map((y) => ({ x, y }));
}

function smallSided(lines: number[]) {
  const xs = lines.length === 2 ? [38, 72] : [30, 52, 74];
  return [KEEPER, ...lines.flatMap((count, index) => outfieldLine(count, xs[index]))];
}

const SLOTS: Record<FormationName, { x: number; y: number }[]> = {
  "2-2": smallSided([2, 2]),
  "1-2-1": smallSided([1, 2, 1]),
  "2-1-1": smallSided([2, 1, 1]),
  "2-3-1": smallSided([2, 3, 1]),
  "3-2-1": smallSided([3, 2, 1]),
  "3-1-2": smallSided([3, 1, 2]),
  "3-3-2": smallSided([3, 3, 2]),
  "3-2-3": smallSided([3, 2, 3]),
  "2-3-3": smallSided([2, 3, 3]),
  "4-4-2": [
    { x: 10, y: 32 },
    { x: 26, y: 10 },
    { x: 26, y: 24 },
    { x: 26, y: 40 },
    { x: 26, y: 54 },
    { x: 50, y: 10 },
    { x: 50, y: 24 },
    { x: 50, y: 40 },
    { x: 50, y: 54 },
    { x: 78, y: 24 },
    { x: 78, y: 40 },
  ],
  "4-3-3": [
    { x: 10, y: 32 },
    { x: 26, y: 10 },
    { x: 26, y: 24 },
    { x: 26, y: 40 },
    { x: 26, y: 54 },
    { x: 50, y: 16 },
    { x: 50, y: 32 },
    { x: 50, y: 48 },
    { x: 80, y: 12 },
    { x: 80, y: 32 },
    { x: 80, y: 52 },
  ],
  "3-5-2": [
    { x: 10, y: 32 },
    { x: 26, y: 16 },
    { x: 26, y: 32 },
    { x: 26, y: 48 },
    { x: 52, y: 8 },
    { x: 52, y: 20 },
    { x: 52, y: 32 },
    { x: 52, y: 44 },
    { x: 52, y: 56 },
    { x: 80, y: 24 },
    { x: 80, y: 40 },
  ],
};

export function placeOnPitch(players: PlayerMatchState[], formation: FormationName) {
  return placeInSlots(players, SLOTS[formation] ?? []);
}

export function placeInSlots(players: PlayerMatchState[], slots: { x: number; y: number }[]) {
  const onPitch = players.filter((player) => player.isOnPitch);
  const keeper = onPitch.find((player) => playsInGoal(player.position));
  const rest = onPitch
    .filter((player) => player.playerId !== keeper?.playerId)
    .sort((a, b) => a.squadNumber - b.squadNumber);
  const ordered = keeper ? [keeper, ...rest] : rest;
  return ordered.slice(0, slots.length).flatMap((player, index) => {
    const slot = slots[index];
    return slot ? [{ player, x: slot.x, y: slot.y }] : [];
  });
}

export function nextCustomFormationName(formations: { name: string }[]) {
  const used = new Set(formations.map((formation) => formation.name.toLowerCase()));
  let count = 1;
  while (used.has(`custom formation ${count}`)) count += 1;
  return `Custom formation ${count}`;
}

export function isFormationName(value: string): value is FormationName {
  return (FORMATIONS as readonly string[]).includes(value);
}

export function FormationPitch({
  formation,
  players,
  emptyMessage,
  positions,
  onMove,
  fieldColor = DEFAULT_PITCH_COLOR,
}: {
  formation: string;
  players: PlayerMatchState[];
  emptyMessage: string | null;
  positions?: { playerId: string; x: number; y: number }[];
  onMove?: (playerId: string, x: number, y: number) => void;
  fieldColor?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const base = isFormationName(formation) ? placeOnPitch(players, formation) : [];
  const placed = (positions ?? base.map((item) => ({ playerId: item.player.playerId, x: item.x, y: item.y })))
    .map((spot) => {
      const player = players.find((item) => item.playerId === spot.playerId && item.isOnPitch);
      return player ? { player, x: spot.x, y: spot.y } : null;
    })
    .filter((item): item is { player: PlayerMatchState; x: number; y: number } => item !== null);

  function pointFrom(event: ReactPointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const raw = svg.createSVGPoint();
    raw.x = event.clientX;
    raw.y = event.clientY;
    const point = raw.matrixTransform(matrix.inverse());
    return {
      x: Math.min(98, Math.max(2, point.x)),
      y: Math.min(62, Math.max(2, point.y)),
    };
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox="0 0 100 64"
        className="match-pitch-svg h-auto w-full max-w-full rounded-lg"
        style={{ backgroundColor: fieldColor }}
        data-pitch="match"
        data-pitch-color={fieldColor}
        role="img"
        aria-label={`${formation} formation`}
        data-formation={formation}
        data-placed={placed.length}
        onPointerMove={(event) => {
          if (!dragId.current || !onMove) return;
          const point = pointFrom(event);
          if (!point) return;
          onMove(dragId.current, point.x, point.y);
        }}
        onPointerUp={() => {
          dragId.current = null;
        }}
        onPointerCancel={() => {
          dragId.current = null;
        }}
      >
        <g fill="none" stroke="#fff6f5" strokeWidth="0.6">
          <rect x="1" y="1" width="98" height="62" />
          <line x1="50" y1="1" x2="50" y2="63" />
          <circle cx="50" cy="32" r="8" />
          <rect x="1" y="16" width="14" height="32" />
          <rect x="85" y="16" width="14" height="32" />
          <rect x="1" y="24" width="5" height="16" />
          <rect x="94" y="24" width="5" height="16" />
        </g>
        {placed.map(({ player, x, y }) => (
          <g
            key={player.playerId}
            data-player-id={player.playerId}
            data-x={x}
            data-y={y}
            transform={`translate(${x} ${y})`}
            className="cursor-grab touch-none"
            onPointerDown={(event) => {
              if (!onMove) return;
              event.preventDefault();
              event.stopPropagation();
              dragId.current = player.playerId;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* the pitch still follows the pointer */
              }
            }}
            onPointerMove={(event) => {
              if (dragId.current !== player.playerId || !onMove) return;
              const point = pointFrom(event);
              if (!point) return;
              onMove(player.playerId, point.x, point.y);
            }}
            onPointerUp={() => {
              if (dragId.current === player.playerId) dragId.current = null;
            }}
          >
            <circle r="4" fill="transparent" />
            <MannequinFigure
              fill={playsInGoal(player.position) ? "#f59e0b" : DEFAULT_PLAYER_COLOR}
              ring="#ffffff"
              label={String(player.squadNumber)}
            />
          </g>
        ))}
      </svg>
        <PitchWatermark />
      </div>
      {emptyMessage ? <p className="mt-2 text-sm font-semibold text-slate-800">{emptyMessage}</p> : null}
    </div>
  );
}

export type { CustomFormation };
