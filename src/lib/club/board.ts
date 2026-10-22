export const PITCH_VIEWS = ["full", "half", "box", "thirds", "channel"] as const;

export type PitchView = (typeof PITCH_VIEWS)[number];

export const PITCH_VIEW_LABEL: Record<PitchView, string> = {
  full: "Full",
  half: "Half",
  box: "Box",
  thirds: "Thirds",
  channel: "Channel",
};

export const SESSION_PHASES = ["Warm-up", "Technical", "Skill", "Small-sided game", "Game"] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

export const PIECE_KINDS = ["player", "keeper", "cone", "mannequin", "goal", "pole"] as const;

export type PieceKind = (typeof PIECE_KINDS)[number];

export const PIECE_LABEL: Record<PieceKind, string> = {
  player: "Player",
  keeper: "Keeper",
  cone: "Cone",
  mannequin: "Mannequin",
  goal: "Goal",
  pole: "Pole",
};

export const MARK_KINDS = ["pass", "run", "dribble", "press", "marker"] as const;

export type MarkKind = (typeof MARK_KINDS)[number];

export const MARK_LABEL: Record<MarkKind, string> = {
  pass: "Pass",
  run: "Run",
  dribble: "Dribble",
  press: "Press",
  marker: "Marker",
};

export interface PitchPoint {
  x: number;
  y: number;
}

export type PieceTeam = "player" | "opponent";

export const DEFAULT_PLAYER_COLOR = "#c8f230";
export const DEFAULT_OPPONENT_COLOR = "#1d4ed8";
export const DEFAULT_PITCH_COLOR = "#047857";

export interface BoardPiece {
  id: string;
  kind: PieceKind;
  x: number;
  y: number;
  label: string;
  team?: PieceTeam;
}

export interface BoardMark {
  id: string;
  kind: MarkKind;
  points: PitchPoint[];
}

export interface BoardFrame {
  id: string;
  pieces: BoardPiece[];
  marks: BoardMark[];
}

export interface DrillBoard {
  view: PitchView;
  phase: SessionPhase;
  speed: number;
  frames: BoardFrame[];
  playerColor?: string;
  opponentColor?: string;
  pitchColor?: string;
}

export function boardColors(board: DrillBoard) {
  return {
    player: board.playerColor || DEFAULT_PLAYER_COLOR,
    opponent: board.opponentColor || DEFAULT_OPPONENT_COLOR,
  };
}

export function pitchFill(board: { pitchColor?: string }) {
  return board.pitchColor || DEFAULT_PITCH_COLOR;
}

export interface PitchWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PITCH_WINDOW: Record<PitchView, PitchWindow> = {
  full: { x: 0, y: 0, width: 100, height: 64 },
  half: { x: 50, y: 0, width: 50, height: 64 },
  box: { x: 80, y: 12, width: 20, height: 40 },
  thirds: { x: 0, y: 0, width: 100, height: 64 },
  channel: { x: 38, y: 0, width: 24, height: 64 },
};

export function emptyDrillBoard(): DrillBoard {
  return {
    view: "full",
    phase: "Technical",
    speed: 1,
    playerColor: DEFAULT_PLAYER_COLOR,
    opponentColor: DEFAULT_OPPONENT_COLOR,
    pitchColor: DEFAULT_PITCH_COLOR,
    frames: [{ id: "frame-1", pieces: [], marks: [] }],
  };
}

export function boardHasPattern(board: DrillBoard | undefined | null) {
  if (!board?.frames?.length) return false;
  return board.frames.some((frame) => frame.pieces.length > 0 || frame.marks.length > 0);
}

function easeStop(amount: number) {
  const t = Math.min(1, Math.max(0, amount));
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

/** Move players and thin lines from one slide toward the next. */
export function blendFrames(from: BoardFrame, to: BoardFrame, amount: number): BoardFrame {
  const t = easeStop(amount);
  const fromPieces = new Map(from.pieces.map((piece) => [piece.id, piece]));
  const toPieces = new Map(to.pieces.map((piece) => [piece.id, piece]));
  const pieceIds = [
    ...from.pieces.map((piece) => piece.id),
    ...to.pieces.filter((piece) => !fromPieces.has(piece.id)).map((piece) => piece.id),
  ];
  const pieces = pieceIds.flatMap((id) => {
    const start = fromPieces.get(id);
    const end = toPieces.get(id);
    if (start && end) return [{ ...end, x: mix(start.x, end.x, t), y: mix(start.y, end.y, t) }];
    const kept = t < 0.5 ? start : end;
    return kept ? [kept] : [];
  });
  const fromMarks = new Map(from.marks.map((mark) => [mark.id, mark]));
  const toMarks = new Map(to.marks.map((mark) => [mark.id, mark]));
  const markIds = [
    ...from.marks.map((mark) => mark.id),
    ...to.marks.filter((mark) => !fromMarks.has(mark.id)).map((mark) => mark.id),
  ];
  const marks = markIds.flatMap((id) => {
    const start = fromMarks.get(id);
    const end = toMarks.get(id);
    if (start && end) {
      const count = Math.max(start.points.length, end.points.length);
      const points = Array.from({ length: count }, (_, index) => {
        const left = start.points[Math.min(index, start.points.length - 1)];
        const right = end.points[Math.min(index, end.points.length - 1)];
        if (!left || !right) return left ?? right;
        return { x: mix(left.x, right.x, t), y: mix(left.y, right.y, t) };
      }).filter((point): point is PitchPoint => Boolean(point));
      return [{ ...end, points }];
    }
    const kept = t < 0.5 ? start : end;
    return kept ? [kept] : [];
  });
  return { id: from.id, pieces, marks };
}

export function clampPoint(point: PitchPoint): PitchPoint {
  return {
    x: Math.min(100, Math.max(0, point.x)),
    y: Math.min(64, Math.max(0, point.y)),
  };
}
