"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import {
  MARK_KINDS,
  MARK_LABEL,
  PIECE_KINDS,
  PIECE_LABEL,
  PITCH_VIEWS,
  PITCH_VIEW_LABEL,
  PITCH_WINDOW,
  SESSION_PHASES,
  clampPoint,
  boardColors,
  DEFAULT_OPPONENT_COLOR,
  DEFAULT_PLAYER_COLOR,
  pitchFill,
  emptyDrillBoard,
  blendFrames,
  type BoardFrame,
  type BoardMark,
  type BoardPiece,
  type DrillBoard as DrillBoardState,
  type MarkKind,
  type PieceKind,
  type PitchPoint,
  type PitchView,
} from "@/lib/club/board";
import { MannequinFigure } from "@/components/pitch/mannequin-figure";
import { useSlideTravel } from "@/components/drills/slide-motion";
import { useClubStore } from "@/stores/club-store";

const SPEEDS = [0.5, 1, 2];

export function DrillBoard({
  drillId,
  setup,
  durationSeconds,
}: {
  drillId: string;
  setup: string;
  durationSeconds: number;
}) {
  return <DrillBoardEditor key={drillId} drillId={drillId} setup={setup} durationSeconds={durationSeconds} />;
}

function DrillBoardEditor({
  drillId,
  setup,
  durationSeconds,
}: {
  drillId: string;
  setup: string;
  durationSeconds: number;
}) {
  const setDrillBoard = useClubStore((state) => state.setDrillBoard);
  const [board, setBoard] = useState<DrillBoardState>(
    () => useClubStore.getState().boards[drillId] ?? emptyDrillBoard(),
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [tool, setTool] = useState<MarkKind | "move">("move");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PitchPoint[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragId = useRef<string | null>(null);
  const idRef = useRef(1);

  function nextId(prefix: string) {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
  }

  const frameCount = board.frames.length;
  const safeIndex = Math.min(frameIndex, Math.max(0, frameCount - 1));
  const shown = board.frames[safeIndex] ?? board.frames[0] ?? { id: "empty", pieces: [], marks: [] };
  const travel = useSlideTravel(playing && frameCount > 1, board.speed, () => {
    setFrameIndex((current) => (Math.min(current, frameCount - 1) + 1) % frameCount);
  });
  const nextFrame = board.frames[(safeIndex + 1) % Math.max(frameCount, 1)] ?? shown;
  const visual = playing && frameCount > 1 ? blendFrames(shown, nextFrame, travel) : shown;
  const windowBox = PITCH_WINDOW[board.view];

  function commit(next: DrillBoardState) {
    setBoard(next);
    setDrillBoard(drillId, next);
  }

  function updateFrame(pieces: BoardPiece[], marks: BoardMark[]) {
    const frames = board.frames.map((item, index) =>
      index === safeIndex ? { ...item, pieces, marks } : item,
    );
    commit({ ...board, frames });
  }

  function addPiece(kind: PieceKind) {
    const count = shown.pieces.filter((piece) => piece.kind === kind).length + 1;
    const piece: BoardPiece = {
      id: nextId("piece"),
      kind,
      x: windowBox.x + windowBox.width / 2 + (count % 5) * 2,
      y: windowBox.y + windowBox.height / 2 + (count % 3) * 2,
      label: kind === "player" || kind === "keeper" ? String(count) : "",
    };
    const point = clampPoint(piece);
    updateFrame([...shown.pieces, { ...piece, ...point }], shown.marks);
    setSelectedId(piece.id);
    setTool("move");
    setPlaying(false);
  }

  function removeSelected() {
    if (!selectedId) return;
    updateFrame(
      shown.pieces.filter((piece) => piece.id !== selectedId),
      shown.marks,
    );
    setSelectedId(null);
  }

  function recordFrame() {
    const snapshot: BoardFrame = {
      id: nextId("frame"),
      pieces: shown.pieces.map((piece) => ({ ...piece })),
      marks: shown.marks.map((mark) => ({ ...mark, points: mark.points.map((point) => ({ ...point })) })),
    };
    const frames = [...board.frames, snapshot];
    commit({ ...board, frames });
    setFrameIndex(frames.length - 1);
    setPlaying(false);
  }

  function clearSlide() {
    if (shown.pieces.length === 0 && shown.marks.length === 0) return;
    updateFrame([], []);
    setSelectedId(null);
    setPlaying(false);
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (playing || tool === "move") return;
    const point = eventPoint(svgRef.current, event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "marker") {
      updateFrame(shown.pieces, [
        ...shown.marks,
        { id: nextId("mark"), kind: "marker", points: [point] },
      ]);
      return;
    }
    setDraft([point]);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = eventPoint(svgRef.current, event);
    if (!point) return;
    if (dragId.current) {
      const pieces = shown.pieces.map((piece) =>
        piece.id === dragId.current ? { ...piece, ...point } : piece,
      );
      updateFrame(pieces, shown.marks);
      return;
    }
    if (!draft) return;
    setDraft([draft[0], point]);
  }

  function onPointerUp() {
    dragId.current = null;
    if (!draft || draft.length < 2 || tool === "move" || tool === "marker") {
      setDraft(null);
      return;
    }
    const [start, end] = draft;
    const mark: BoardMark = {
      id: nextId("mark"),
      kind: tool,
      points:
        tool === "press"
          ? [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }]
          : [start, end],
    };
    updateFrame(shown.pieces, [...shown.marks, mark]);
    setDraft(null);
  }

  const minutes = Math.round(durationSeconds / 60);

  return (
    <section className="w-full min-w-0 max-w-full rounded-xl bg-white p-3 ring-1 ring-slate-300">
      <div className="min-w-0">
        <p className="mb-1 truncate text-sm font-semibold text-slate-800">
          {board.phase} · {minutes} min · {setup}
        </p>
        <svg
          ref={svgRef}
          viewBox={`${windowBox.x} ${windowBox.y} ${windowBox.width} ${windowBox.height}`}
          className="editor-pitch-svg h-auto w-full max-w-full touch-none rounded-lg"
          style={{ backgroundColor: pitchFill(board) }}
          data-pitch="session"
          data-pitch-color={pitchFill(board)}
          role="img"
          aria-label="Drill pitch"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <marker id={`arrow-${drillId}`} markerWidth="2.2" markerHeight="2.2" refX="1.8" refY="1.1" orient="auto">
              <path d="M0 0 L2.2 1.1 L0 2.2 Z" fill="#f8fafc" />
            </marker>
          </defs>
          <PitchLines view={board.view} />
          {visual.marks.map((mark) => (
            <MarkShape key={mark.id} mark={mark} markerId={`arrow-${drillId}`} />
          ))}
          {draft && draft.length === 2 && tool !== "move" ? (
            <MarkShape
              markerId={`arrow-${drillId}`}
              mark={{
                id: "draft",
                kind: tool,
                points:
                  tool === "press"
                    ? [draft[0], { x: draft[1].x, y: draft[0].y }, draft[1], { x: draft[0].x, y: draft[1].y }]
                    : draft,
              }}
            />
          ) : null}
          {visual.pieces.map((piece) => (
            <PieceShape
              key={piece.id}
              piece={piece}
              colors={boardColors(board)}
              selected={piece.id === selectedId}
              onPointerDown={(event) => {
                if (playing || tool !== "move") return;
                event.stopPropagation();
                svgRef.current?.setPointerCapture(event.pointerId);
                dragId.current = piece.id;
                setSelectedId(piece.id);
              }}
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 min-w-0 space-y-3">
        <ControlRow label="Field">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-950">
            Colour
            <input
              type="color"
              aria-label="Field colour"
              data-field="pitch-color"
              value={pitchFill(board)}
              onChange={(event) => commit({ ...board, pitchColor: event.target.value })}
              className="size-11 cursor-pointer rounded-md border border-slate-300 bg-transparent p-0.5"
            />
          </label>
        </ControlRow>
        <ControlRow label="View">
          {PITCH_VIEWS.map((view) => (
            <Chip key={view} active={board.view === view} onClick={() => commit({ ...board, view })}>
              {PITCH_VIEW_LABEL[view]}
            </Chip>
          ))}
        </ControlRow>
        <ControlRow label="Phase">
          {SESSION_PHASES.map((phase) => (
            <Chip key={phase} active={board.phase === phase} onClick={() => commit({ ...board, phase })}>
              {phase}
            </Chip>
          ))}
        </ControlRow>
        <ControlRow label="Place">
          {PIECE_KINDS.map((kind) => (
            <Chip key={kind} active={false} onClick={() => addPiece(kind)}>
              {PIECE_LABEL[kind]}
            </Chip>
          ))}
        </ControlRow>
        <ControlRow label="Draw">
          <Chip active={tool === "move"} onClick={() => setTool("move")}>
            Move
          </Chip>
          {MARK_KINDS.map((kind) => (
            <Chip key={kind} active={tool === kind} onClick={() => setTool(kind)}>
              {MARK_LABEL[kind]}
            </Chip>
          ))}
          <Chip active={false} onClick={removeSelected}>
            Remove
          </Chip>
        </ControlRow>
        <ControlRow label="Frames">
          <Chip active={false} onClick={recordFrame}>
            Record
          </Chip>
          <Chip active={false} onClick={clearSlide}>
            Clear
          </Chip>
          <Chip
            active={playing}
            onClick={() => {
              if (frameCount < 2) return;
              setPlaying((current) => !current);
            }}
          >
            {playing ? "Pause" : "Play"}
          </Chip>
          {SPEEDS.map((speed) => (
            <Chip key={speed} active={board.speed === speed} onClick={() => commit({ ...board, speed })}>
              {speed}x
            </Chip>
          ))}
        </ControlRow>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
          Frame {safeIndex + 1} / {frameCount}
          <input
            type="range"
            min={0}
            max={Math.max(0, frameCount - 1)}
            step={1}
            value={safeIndex}
            onChange={(event) => {
              setPlaying(false);
              setFrameIndex(Math.round(Number(event.target.value)));
            }}
            className="mt-2 block h-11 w-full accent-[#0f766e]"
          />
        </label>
      </div>
    </section>
  );
}

export const DRAW_STROKE = 0.28;

export function eventPoint(svg: SVGSVGElement | null, event: ReactPointerEvent): PitchPoint | null {
  if (!svg) return null;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const raw = svg.createSVGPoint();
  raw.x = event.clientX;
  raw.y = event.clientY;
  return clampPoint(raw.matrixTransform(matrix.inverse()));
}

export function PitchLines({ view }: { view: PitchView }) {
  return (
    <g fill="none" stroke="#fff6f5" strokeWidth="0.6">
      <rect x="1" y="1" width="98" height="62" />
      <line x1="50" y1="1" x2="50" y2="63" />
      <circle cx="50" cy="32" r="8" />
      <rect x="1" y="16" width="14" height="32" />
      <rect x="85" y="16" width="14" height="32" />
      <rect x="1" y="24" width="5" height="16" />
      <rect x="94" y="24" width="5" height="16" />
      {view === "thirds" ? (
        <g stroke="#fde68a" strokeDasharray="1.2 1">
          <line x1="33.3" y1="1" x2="33.3" y2="63" />
          <line x1="66.6" y1="1" x2="66.6" y2="63" />
        </g>
      ) : null}
      {view === "channel" ? <rect x="38" y="1" width="24" height="62" fill="#0b5f59" fillOpacity="0.35" stroke="none" /> : null}
    </g>
  );
}

export function MarkShape({ mark, markerId }: { mark: BoardMark; markerId: string }) {
  const [start, end] = mark.points;
  if (!start) return null;
  if (mark.kind === "marker") {
    return (
      <g stroke="#fef08a" strokeWidth={DRAW_STROKE}>
        <line x1={start.x - 1.2} y1={start.y - 1.2} x2={start.x + 1.2} y2={start.y + 1.2} />
        <line x1={start.x - 1.2} y1={start.y + 1.2} x2={start.x + 1.2} y2={start.y - 1.2} />
      </g>
    );
  }
  if (mark.kind === "press" && mark.points.length >= 4) {
    const points = mark.points.map((point) => `${point.x},${point.y}`).join(" ");
    return <polygon points={points} fill="#f59e0b" fillOpacity="0.35" stroke="#fef3c7" strokeWidth={DRAW_STROKE} />;
  }
  if (!end) return null;
  const dash = mark.kind === "run" ? "1.4 0.8" : mark.kind === "dribble" ? "0.3 0.8" : undefined;
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={mark.kind === "dribble" ? "#e2e8f0" : "#f8fafc"}
      strokeWidth={DRAW_STROKE}
      strokeDasharray={dash}
      markerEnd={`url(#${markerId})`}
    />
  );
}

export function PieceShape({
  piece,
  selected,
  onPointerDown,
  colors,
}: {
  piece: BoardPiece;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  colors?: { player: string; opponent: string };
}) {
  const ring = selected ? "#fef08a" : "#ffffff";
  const palette = colors ?? { player: DEFAULT_PLAYER_COLOR, opponent: DEFAULT_OPPONENT_COLOR };
  const person = piece.kind === "player" || piece.kind === "keeper" || piece.kind === "mannequin";
  const fill =
    piece.kind === "mannequin"
      ? "#e2e8f0"
      : piece.team === "opponent"
        ? palette.opponent
        : piece.kind === "keeper"
          ? "#f59e0b"
          : palette.player;
  return (
    <g transform={`translate(${piece.x} ${piece.y})`} onPointerDown={onPointerDown} className="cursor-grab">
      <circle r="2.6" fill="transparent" />
      {person ? <MannequinFigure fill={fill} ring={ring} label={piece.kind === "mannequin" ? "" : piece.label} /> : null}
      {piece.kind === "cone" ? <polygon points="0,-2.2 -1.6,1.8 1.6,1.8" fill="#f97316" stroke={ring} strokeWidth="0.3" /> : null}
      {piece.kind === "goal" ? <path d="M-2.4 -1.4 h4.8 v3.2 h-4.8" fill="none" stroke={ring} strokeWidth="0.45" /> : null}
      {piece.kind === "pole" ? (
        <g stroke={ring} strokeWidth="0.45">
          <line y1="-2.4" y2="2.2" />
          <circle cy="-2.4" r="0.45" fill="#f8fafc" />
        </g>
      ) : null}
      {piece.label && !person ? (
        <text y="0.7" textAnchor="middle" fontSize="2" fontWeight="700" fill="#ffffff">
          {piece.label}
        </text>
      ) : null}
    </g>
  );
}

function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md px-3 text-sm font-bold ${active ? "btn-shade" : "btn-quiet"}`}
    >
      {children}
    </button>
  );
}
