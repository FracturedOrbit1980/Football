import { ensureYouthAges } from "@/lib/club/age";
import type { ClubAgeGroup, DrillTemplate, SetupDiagram } from "@/lib/club/catalog";
import { DEFAULT_PITCH_COLOR, type DrillBoard } from "@/lib/club/board";
import { mergeLibraryBoards } from "@/lib/club/library-boards";
import { clubLibrary } from "@/lib/club/library";
import { placeOnU12Prem, playerId, SQUAD_TEAM_ID, U12_SQUAD } from "@/lib/club/roster";

export interface ClubPlayer {
  id: string;
  name: string;
  squadNumber: number;
  position: string;
  positions?: string[];
  teamId: string;
  homework: string;
  photo?: string;
  seasonFee: number;
  feePaid: number;
  accessPin: string;
}

export interface ClubCoach {
  id: string;
  name: string;
  teamId: string;
}

export interface ClubDrill extends DrillTemplate {
  durationSeconds: number;
  diagram: SetupDiagram;
}

export interface EvaluationRecord {
  id: string;
  playerId: string;
  date: string;
  technical: number;
  tactical: number;
  physical: number;
  mental: number;
  notes: string;
}

export interface AttendanceRecord {
  id: string;
  playerId: string;
  when: string;
  detail: string;
  status: "Present" | "Absent";
}

export interface TrainingMark {
  playerId: string;
  date: string;
  present: boolean;
}

export type TrainingStatus = "Present" | "Not present" | "Not marked";

export interface WeeklyReport {
  id: string;
  playerId: string;
  teamId: string;
  weekStart: string;
  gameDay: string;
  attendance: { date: string; status: TrainingStatus }[];
  gameFeedback: string;
}

export interface SessionPlan {
  id: string;
  teamId: string;
  title: string;
  drillIds: string[];
  savedOn: string;
}

export interface SavedMatch {
  id: string;
  teamId: string;
  opponent: string;
  playedOn: string;
  minutes: { playerId: string; minutesPlayed: number }[];
}

export interface CustomFormation {
  id: string;
  name: string;
  slots: { x: number; y: number }[];
}

export interface ClubData {
  clubKind: "bnfc" | "custom";
  customFormations: CustomFormation[];
  ageGroups: ClubAgeGroup[];
  coaches: ClubCoach[];
  players: ClubPlayer[];
  drills: ClubDrill[];
  evaluations: EvaluationRecord[];
  attendance: AttendanceRecord[];
  trainingMarks: TrainingMark[];
  weeklyReports: WeeklyReport[];
  sessions: SessionPlan[];
  matches: SavedMatch[];
  coachTeamId: string | null;
  boards: Record<string, DrillBoard>;
  matchPitchColor: string;
}

export function createSeed(): ClubData {
  const placed = placeOnU12Prem(
    ensureYouthAges([]),
    U12_SQUAD.map((player) => ({
      id: playerId(player.name),
      name: player.name,
      squadNumber: player.squadNumber,
      position: "Central midfielder",
      positions: [] as string[],
      teamId: SQUAD_TEAM_ID,
      homework: "",
      photo: "",
      seasonFee: 0,
      feePaid: 0,
      accessPin: "",
    })),
  );
  return {
    clubKind: "bnfc",
    customFormations: [],
    ageGroups: placed.ageGroups,
    coaches: [],
    players: placed.players,
    drills: clubLibrary.map((drill) => ({
      ...drill,
      coachingPoints: [...drill.coachingPoints],
      durationSeconds: drill.defaultDurationSeconds,
    })),
    evaluations: [],
    attendance: [],
    trainingMarks: [],
    weeklyReports: [],
    sessions: [],
    matches: [],
    coachTeamId: placed.teamId,
    boards: mergeLibraryBoards({}),
    matchPitchColor: DEFAULT_PITCH_COLOR,
  };
}

export function createEmptyClub(): ClubData {
  return {
    clubKind: "custom",
    customFormations: [],
    ageGroups: ensureYouthAges([]),
    coaches: [],
    players: [],
    drills: clubLibrary.map((drill) => ({
      ...drill,
      coachingPoints: [...drill.coachingPoints],
      durationSeconds: drill.defaultDurationSeconds,
    })),
    evaluations: [],
    attendance: [],
    trainingMarks: [],
    weeklyReports: [],
    sessions: [],
    matches: [],
    coachTeamId: null,
    boards: mergeLibraryBoards({}),
    matchPitchColor: DEFAULT_PITCH_COLOR,
  };
}
