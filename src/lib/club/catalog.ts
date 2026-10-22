export const CLUB_NAME = "Clubstride";

export const MOMENTS_OF_GAME = [
  { id: "IP", label: "In possession" },
  { id: "OOP", label: "Out of possession" },
  { id: "T2A", label: "Transition to attack" },
  { id: "T2D", label: "Transition to defence" },
] as const;

export type MomentOfGame = (typeof MOMENTS_OF_GAME)[number]["id"];

export const DRILL_TYPES = [
  { id: "WU", label: "Warm-up" },
  { id: "TP", label: "Technical" },
  { id: "SP", label: "Skill" },
  { id: "Rondo", label: "Rondo" },
  { id: "PoP", label: "Phase of play" },
  { id: "SSG", label: "Small-sided game" },
  { id: "11v11", label: "11v11" },
  { id: "Physical", label: "Physical" },
] as const;

export type DrillType = (typeof DRILL_TYPES)[number]["id"];

export const DRILL_LEVELS = ["Grassroots", "Youth U9-12", "Youth U13-16", "Senior Amateur", "Pro"] as const;

export type DrillLevel = (typeof DRILL_LEVELS)[number];

export const SKILL_LEVELS = ["Beginner", "Intermediate", "Professional"] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const LICENSE_LEVELS = ["Grassroots", "UEFA C", "UEFA B", "UEFA A", "UEFA Pro"] as const;

export type LicenseLevel = (typeof LICENSE_LEVELS)[number];

export interface PlayerCount {
  attackers: number;
  defenders: number;
  neutrals: number;
  goalkeepers: number;
}

export const SETUP_DIAGRAMS = ["square", "channel", "rondo", "overlap", "press", "gates", "lanes", "corner"] as const;

export type SetupDiagram = (typeof SETUP_DIAGRAMS)[number];

export const DIVISIONS = ["Prem", "Div 1", "Div 2", "Div 3", "Div 4"] as const;

export type Division = (typeof DIVISIONS)[number];

const PREVIOUS_DIVISION: Record<string, Division> = {
  Perm: "Prem",
  Div1: "Div 1",
};

export function isDivision(value: string): value is Division {
  return (DIVISIONS as readonly string[]).includes(value);
}

export function canonicalDivision(value: string | undefined | null): Division | undefined {
  if (!value) return undefined;
  if (isDivision(value)) return value;
  return PREVIOUS_DIVISION[value];
}

export function canonicalTeamName(name: string) {
  return PREVIOUS_DIVISION[name] ?? name;
}

export function drillTitle(type: string, focus: string, setup: string, constraint: string) {
  return [type, focus, setup, constraint]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" - ")
    .slice(0, 60);
}

export interface ClubTeam {
  id: string;
  name: string;
  gameDay?: string;
  division?: Division;
}

export interface ClubAgeGroup {
  id: string;
  name: string;
  displayOrder: number;
  teams: ClubTeam[];
}

export interface DrillTemplate {
  id: string;
  title: string;
  isClubOfficial: boolean;
  targetAgeGroup: string;
  moment: MomentOfGame;
  drillType: DrillType;
  level: DrillLevel;
  focus: string;
  playerSetup: string;
  constraint: string;
  dimensions: string;
  workRest: string;
  repetitions: number;
  players: PlayerCount;
  equipment: string[];
  diagram: SetupDiagram;
  pitchSetup: string;
  instructions: string;
  coachingPoints: string[];
  progressions: string[];
  tags: string[];
  licenseLevel: LicenseLevel;
  ageBand: string;
  youthAge: number;
  skillLevel: SkillLevel;
  minPlayers: number;
  maxPlayers: number;
  pitchLengthM: number;
  pitchWidthM: number;
  defaultDurationSeconds: number;
  videoUrl?: string;
  videoName?: string;
}
