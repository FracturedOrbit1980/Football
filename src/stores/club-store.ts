import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ageNumber, ensureYouthAges, sortByAge } from "@/lib/club/age";
import { normalizePositions } from "@/lib/club/positions";
import { canonicalDivision, canonicalTeamName, type Division, type DrillLevel, type DrillType, type MomentOfGame, type PlayerCount, type SetupDiagram } from "@/lib/club/catalog";
import { isDrillLevel, isDrillType, isMoment, skillOf, withUefaDrills, youthAgeOf } from "@/lib/club/drill-record";
import { DEFAULT_PITCH_COLOR, type DrillBoard } from "@/lib/club/board";
import { mergeLibraryBoards } from "@/lib/club/library-boards";
import { isRetiredSeedPlayer, playerId, type RosterRow } from "@/lib/club/roster";
import { weekDates } from "@/lib/club/week";
import { clubDataKey } from "@/lib/club/registry";
import {
  createEmptyClub,
  createSeed,
  type AttendanceRecord,
  type ClubData,
  type ClubDrill,
  type EvaluationRecord,
  type MatchExtra,
  type SavedMatch,
  type SessionPlan,
  type TrainingStatus,
} from "@/lib/club/seed";

export interface NewDrillInput {
  title: string;
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
  progressions: string[];
  targetAgeGroup: string;
  durationSeconds: number;
  diagram: SetupDiagram;
  pitchSetup: string;
  instructions: string;
  coachingPoints: string[];
  isClubOfficial: boolean;
}

export interface NewPlayerInput {
  name: string;
  squadNumber: number;
  position: string;
  positions?: string[];
  teamId: string;
  photo?: string;
}

export interface NewEvaluationInput {
  playerId: string;
  technical: number;
  tactical: number;
  physical: number;
  mental: number;
  notes: string;
}

interface ClubState extends ClubData {
  hydrated: boolean;
  setDrillDuration: (drillId: string, seconds: number) => void;
  addDrill: (input: NewDrillInput) => void;
  setDrillOfficial: (drillId: string, official: boolean) => void;
  setDrillVideo: (drillId: string, videoUrl: string, videoName: string) => void;
  addAgeGroup: (age: number) => void;
  addTeam: (ageGroupId: string, name: string, division: Division) => void;
  openDivisionTeam: (ageGroupId: string, division: Division) => string;
  setTeamDivision: (teamId: string, division: Division) => void;
  setCoachTeam: (teamId: string) => void;
  addPlayer: (input: NewPlayerInput) => void;
  importPlayers: (rows: RosterRow[]) => { added: number; updated: number };
  updatePlayer: (playerId: string, input: { name: string; squadNumber: number; position: string; positions?: string[]; photo?: string }) => void;
  setPlayerPhoto: (playerId: string, photo: string) => void;
  assignPlayer: (playerId: string, teamId: string) => void;
  deletePlayer: (playerId: string) => void;
  addCoach: (teamId: string, name: string) => void;
  addEvaluation: (input: NewEvaluationInput) => void;
  setHomework: (playerId: string, homework: string) => void;
  setTeamGameDay: (teamId: string, gameDay: string) => void;
  setTrainingAttendance: (playerId: string, date: string, present: boolean) => void;
  saveWeeklyReport: (playerId: string, teamId: string, weekStart: string, gameFeedback: string) => void;
  saveSession: (teamId: string, title: string, drillIds: string[]) => void;
  saveMatch: (
    teamId: string,
    opponent: string,
    minutes: { playerId: string; minutesPlayed: number }[],
    matchId?: string,
    extra?: MatchExtra,
  ) => void;
  /** Club mode: put a saved match on a club team (re-queues it for sync). */
  assignMatchTeam: (matchId: string, cloudTeamId: string) => void;
  saveCustomFormation: (name: string, slots: { x: number; y: number }[]) => string;
  setDrillBoard: (drillId: string, board: DrillBoard) => void;
  setMatchPitchColor: (color: string) => void;
  saveEditorDrill: (
    drillId: string | null,
    input: {
      title: string;
      durationSeconds: number;
      pitchSetup: string;
      coachingPoints: string[];
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
      progressions: string[];
      instructions: string;
      videoUrl: string;
      videoName: string;
    },
    board: DrillBoard,
  ) => string;
  resetClub: () => void;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const useClubStore = create<ClubState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...createSeed(),
      setDrillDuration: (drillId, seconds) =>
        set((state) => ({
          drills: state.drills.map((drill) =>
            drill.id === drillId ? { ...drill, durationSeconds: seconds } : drill,
          ),
        })),
      addDrill: (input) =>
        set((state) => ({
          drills: [
            {
              id: `dr-${Date.now()}`,
              title: input.title.slice(0, 60),
              isClubOfficial: input.isClubOfficial,
              targetAgeGroup: input.targetAgeGroup,
              moment: input.moment,
              drillType: input.drillType,
              level: input.level,
              focus: input.focus,
              playerSetup: input.playerSetup,
              constraint: input.constraint,
              dimensions: input.dimensions,
              workRest: input.workRest,
              repetitions: input.repetitions,
              players: input.players,
              equipment: input.equipment,
              progressions: input.progressions,
              tags: [],
              licenseLevel: "Grassroots",
              ageBand: input.targetAgeGroup,
              youthAge: youthAgeOf({ targetAgeGroup: input.targetAgeGroup }),
              skillLevel: skillOf({ level: input.level }),
              minPlayers: input.players.attackers + input.players.defenders + input.players.neutrals,
              maxPlayers: input.players.attackers + input.players.defenders + input.players.neutrals,
              pitchLengthM: 0,
              pitchWidthM: 0,
              diagram: input.diagram,
              pitchSetup: input.pitchSetup,
              instructions: input.instructions,
              coachingPoints: input.coachingPoints,
              defaultDurationSeconds: input.durationSeconds,
              durationSeconds: input.durationSeconds,
              videoUrl: "",
              videoName: "",
            },
            ...state.drills,
          ],
        })),
      setDrillOfficial: (drillId, official) =>
        set((state) => ({
          drills: state.drills.map((drill) =>
            drill.id === drillId ? { ...drill, isClubOfficial: official } : drill,
          ),
        })),
      setDrillVideo: (drillId, videoUrl, videoName) =>
        set((state) => ({
          drills: state.drills.map((drill) =>
            drill.id === drillId ? { ...drill, videoUrl, videoName } : drill,
          ),
        })),
      addPlayer: (input) =>
        set((state) => ({
          players: [
            ...state.players,
            {
              id: `p-${Date.now()}`,
              name: input.name,
              squadNumber: input.squadNumber,
              ...normalizePositions(input.position, input.positions),
              teamId: input.teamId,
              homework: "",
              photo: input.photo ?? "",
            },
          ],
        })),
      importPlayers: (rows) => {
        const state = get();
        const teamId = state.coachTeamId;
        if (!teamId || !state.ageGroups.some((group) => group.teams.some((team) => team.id === teamId))) {
          return { added: 0, updated: 0 };
        }
        const players = [...state.players];
        let added = 0;
        let updated = 0;
        for (const row of rows) {
          const name = row.name.trim().replace(/\s+/g, " ");
          const index = players.findIndex(
            (player) => player.teamId === teamId && player.name.trim().toLowerCase() === name.toLowerCase(),
          );
          if (index >= 0) {
            players[index] = {
              ...players[index],
              name,
              squadNumber: row.squadNumber,
            };
            updated += 1;
          } else {
            const id = playerId(name);
            players.push({
              id: players.some((player) => player.id === id) ? `${id}-${teamId}-${Date.now()}-${added}` : id,
              name,
              squadNumber: row.squadNumber,
              position: "Central midfielder",
              positions: [],
              teamId,
              homework: "",
              photo: "",
            });
            added += 1;
          }
        }
        set({ players });
        return { added, updated };
      },
      updatePlayer: (playerId, input) =>
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  name: input.name,
                  squadNumber: input.squadNumber,
                  ...normalizePositions(input.position, input.positions),
                  ...(input.photo !== undefined ? { photo: input.photo } : {}),
                }
              : player,
          ),
        })),
      setPlayerPhoto: (playerId, photo) =>
        set((state) => ({
          players: state.players.map((player) => (player.id === playerId ? { ...player, photo } : player)),
        })),
      assignPlayer: (playerId, teamId) =>
        set((state) => ({
          players: state.players.map((player) => (player.id === playerId ? { ...player, teamId } : player)),
        })),
      deletePlayer: (playerId) =>
        set((state) => ({
          players: state.players.filter((player) => player.id !== playerId),
          trainingMarks: state.trainingMarks.filter((mark) => mark.playerId !== playerId),
          weeklyReports: state.weeklyReports.filter((report) => report.playerId !== playerId),
        })),
      addCoach: (teamId, name) =>
        set((state) => ({
          coaches: [
            ...state.coaches.filter((coach) => coach.teamId !== teamId),
            { id: `c-${Date.now()}`, name, teamId },
          ],
        })),
      addAgeGroup: (age) =>
        set((state) => {
          const number = Math.round(age);
          if (!Number.isInteger(number) || number < 1 || number > 99) return state;
          if (state.ageGroups.some((group) => ageNumber(group.name) === number)) return state;
          return {
            ageGroups: sortByAge([
              ...state.ageGroups,
              {
                id: `ag-${Date.now()}`,
                name: `U${number}`,
                displayOrder: number,
                teams: [],
              },
            ]),
          };
        }),
      setCoachTeam: (teamId) => set({ coachTeamId: teamId }),
      openDivisionTeam: (ageGroupId, division) => {
        let opened = "";
        set((state) => {
          const ageGroups = ensureYouthAges(state.ageGroups);
          const group = ageGroups.find((item) => item.id === ageGroupId);
          if (!group) return { ageGroups };
          const existing = group.teams.find((team) => team.division === division);
          if (existing) {
            opened = existing.id;
            return { ageGroups, coachTeamId: existing.id };
          }
          const undivided = group.teams.filter((team) => !team.division);
          if (group.teams.length === 1 && undivided.length === 1) {
            opened = undivided[0].id;
            return {
              coachTeamId: opened,
              ageGroups: ageGroups.map((item) =>
                item.id === ageGroupId
                  ? {
                      ...item,
                      teams: item.teams.map((team) =>
                        team.id === opened ? { ...team, name: division, division } : team,
                      ),
                    }
                  : item,
              ),
            };
          }
          opened = `tm-${Date.now()}`;
          return {
            coachTeamId: opened,
            ageGroups: ageGroups.map((item) =>
              item.id === ageGroupId
                ? { ...item, teams: [...item.teams, { id: opened, name: division, division }] }
                : item,
            ),
          };
        });
        return opened;
      },
      addTeam: (ageGroupId, name, division) =>
        set((state) => ({
          ageGroups: state.ageGroups.map((group) =>
            group.id === ageGroupId
              ? {
                  ...group,
                  teams: [...group.teams, { id: `tm-${Date.now()}`, name, division }],
                }
              : group,
          ),
        })),
      setTeamDivision: (teamId, division) =>
        set((state) => ({
          ageGroups: state.ageGroups.map((group) => ({
            ...group,
            teams: group.teams.map((team) => (team.id === teamId ? { ...team, division } : team)),
          })),
        })),
      addEvaluation: (input) =>
        set((state) => ({
          evaluations: [
            {
              id: `ev-${Date.now()}`,
              date: todayIso(),
              ...input,
            },
            ...state.evaluations,
          ],
        })),
      setHomework: (playerId, homework) =>
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId ? { ...player, homework } : player,
          ),
        })),
      setTeamGameDay: (teamId, gameDay) =>
        set((state) => ({
          ageGroups: state.ageGroups.map((group) => ({
            ...group,
            teams: group.teams.map((team) => (team.id === teamId ? { ...team, gameDay } : team)),
          })),
        })),
      setTrainingAttendance: (playerId, date, present) =>
        set((state) => {
          const existing = state.trainingMarks.some((mark) => mark.playerId === playerId && mark.date === date);
          return {
            trainingMarks: existing
              ? state.trainingMarks.map((mark) =>
                  mark.playerId === playerId && mark.date === date ? { ...mark, present } : mark,
                )
              : [...state.trainingMarks, { playerId, date, present }],
          };
        }),
      saveWeeklyReport: (playerId, teamId, weekStart, gameFeedback) =>
        set((state) => {
          const attendance = weekDates(weekStart).map((date) => {
            const mark = state.trainingMarks.find((item) => item.playerId === playerId && item.date === date);
            const status: TrainingStatus = mark ? (mark.present ? "Present" : "Not present") : "Not marked";
            return { date, status };
          });
          const gameDay = state.ageGroups.flatMap((group) => group.teams).find((team) => team.id === teamId)?.gameDay ?? "";
          const next = {
            id: `wr-${playerId}-${weekStart}`,
            playerId,
            teamId,
            weekStart,
            gameDay,
            attendance,
            gameFeedback: gameFeedback.trim(),
          };
          const exists = state.weeklyReports.some((report) => report.id === next.id);
          return {
            weeklyReports: exists
              ? state.weeklyReports.map((report) => (report.id === next.id ? next : report))
              : [next, ...state.weeklyReports],
          };
        }),
      saveSession: (teamId, title, drillIds) =>
        set((state) => ({
          sessions: [
            {
              id: `ses-${Date.now()}`,
              teamId,
              title,
              drillIds,
              savedOn: todayLabel(),
            },
            ...state.sessions,
          ],
        })),
      assignMatchTeam: (matchId, cloudTeamId) =>
        set((state) => ({
          matches: state.matches.map((match) =>
            match.id === matchId ? { ...match, cloudTeamId, updatedAt: new Date().toISOString() } : match,
          ),
        })),
      saveMatch: (teamId, opponent, minutes, matchId, extra) =>
        set((state) => {
          const id = matchId || `match-${Date.now()}`;
          const previous = state.matches.find((item) => item.id === id);
          const playedOn = previous?.playedOn ?? todayLabel();
          const match: SavedMatch = { ...extra, id, teamId, opponent, playedOn, minutes, updatedAt: new Date().toISOString() };
          const prefix = `att-${id}-`;
          const attendance: AttendanceRecord[] = minutes.map((row) => ({
            id: `${prefix}${row.playerId}`,
            playerId: row.playerId,
            when: playedOn,
            detail: `vs ${opponent}`,
            status: row.minutesPlayed > 0 ? "Present" : "Absent",
          }));
          // Saving the same match again replaces its record and attendance instead of adding duplicates.
          return {
            matches: [match, ...state.matches.filter((item) => item.id !== id)],
            attendance: [...attendance, ...state.attendance.filter((item) => !item.id.startsWith(prefix))],
          };
        }),
      saveCustomFormation: (name, slots) => {
        const trimmed = name.trim() || "Custom formation 1";
        const existing = get().customFormations.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          set((state) => ({
            customFormations: state.customFormations.map((item) => (item.id === existing.id ? { ...item, slots } : item)),
          }));
          return existing.id;
        }
        const id = `form-${Date.now()}`;
        set((state) => ({
          customFormations: [...state.customFormations, { id, name: trimmed, slots }],
        }));
        return id;
      },
      setMatchPitchColor: (color) => set({ matchPitchColor: color }),
      setDrillBoard: (drillId, board) =>
        set((state) => ({
          boards: { ...state.boards, [drillId]: board },
        })),
      saveEditorDrill: (drillId, input, board) => {
        let savedId = "";
        set((state) => {
          const reusable =
            drillId !== null &&
            state.drills.some((drill) => drill.id === drillId && !drill.isClubOfficial);
          savedId = reusable && drillId ? drillId : `dr-e-${Date.now()}`;
          const existing = state.drills.find((drill) => drill.id === savedId);
          const next = {
            id: savedId,
            title: input.title.slice(0, 60),
            isClubOfficial: false,
            targetAgeGroup: existing?.targetAgeGroup ?? "All ages",
            moment: input.moment,
            drillType: input.drillType,
            level: input.level,
            focus: input.focus,
            playerSetup: input.playerSetup,
            constraint: input.constraint,
            dimensions: input.dimensions,
            workRest: input.workRest,
            repetitions: input.repetitions,
            players: input.players,
            equipment: input.equipment,
            progressions: input.progressions,
            tags: existing?.tags ?? [],
            licenseLevel: existing?.licenseLevel ?? "Grassroots",
            ageBand: existing?.ageBand ?? existing?.targetAgeGroup ?? "All ages",
            youthAge: existing?.youthAge ?? youthAgeOf({ targetAgeGroup: existing?.targetAgeGroup, ageBand: existing?.ageBand }),
            skillLevel: existing?.skillLevel ?? skillOf({ level: input.level }),
            minPlayers: existing?.minPlayers ?? input.players.attackers + input.players.defenders + input.players.neutrals,
            maxPlayers: existing?.maxPlayers ?? input.players.attackers + input.players.defenders + input.players.neutrals,
            pitchLengthM: existing?.pitchLengthM ?? 0,
            pitchWidthM: existing?.pitchWidthM ?? 0,
            diagram: existing?.diagram ?? "square",
            pitchSetup: input.pitchSetup,
            instructions: input.instructions || input.pitchSetup || "Lay out on the pitch.",
            coachingPoints: input.coachingPoints,
            defaultDurationSeconds: existing?.defaultDurationSeconds ?? input.durationSeconds,
            durationSeconds: input.durationSeconds,
            videoUrl: input.videoUrl,
            videoName: input.videoName,
          };
          return {
            drills: existing
              ? state.drills.map((drill) => (drill.id === savedId ? next : drill))
              : [next, ...state.drills],
            boards: { ...state.boards, [savedId]: board },
          };
        });
        return savedId;
      },
      resetClub: () => set({ hydrated: true, ...(get().clubKind === "custom" ? createEmptyClub() : createSeed()) }),
    }),
    {
      name: "bnfc-club-v3",
      skipHydration: true,
      partialize: (state) => ({
        clubKind: state.clubKind,
        customFormations: state.customFormations,
        ageGroups: state.ageGroups,
        coaches: state.coaches,
        players: state.players,
        drills: state.drills,
        evaluations: state.evaluations,
        attendance: state.attendance,
        trainingMarks: state.trainingMarks,
        weeklyReports: state.weeklyReports,
        sessions: state.sessions,
        matches: state.matches,
        coachTeamId: state.coachTeamId,
        boards: state.boards,
        matchPitchColor: state.matchPitchColor,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ClubData>;
        const kind = saved.clubKind === "custom" ? "custom" : "bnfc";
        const baseline = kind === "custom" ? createEmptyClub() : createSeed();
        const savedPlayers = saved.players ?? [];
        const ageGroups = ensureYouthAges(saved.ageGroups ?? baseline.ageGroups).map((group) => ({
          ...group,
          teams: (group.teams ?? []).map((team) => ({
            ...team,
            name: canonicalTeamName(team.name ?? ""),
            division: canonicalDivision(team.division) ?? canonicalDivision(team.name),
          })),
        }));
        // Drop players left over from the retired built-in demo squad, plus their records.
        const retired = new Set(
          savedPlayers.filter((player) => isRetiredSeedPlayer(player)).map((player) => player.id),
        );
        const players = savedPlayers
          .filter((player) => !retired.has(player.id))
          .map((player) => {
            const next = { ...player } as typeof player & { dateOfBirth?: string };
            delete next.dateOfBirth;
            return {
              ...next,
              ...normalizePositions(player.position, player.positions),
              photo: typeof player.photo === "string" ? player.photo : "",
            };
          });
        const keep = <T extends { playerId: string }>(rows: T[] | undefined) =>
          (rows ?? []).filter((row) => !retired.has(row.playerId));
        const matches = (saved.matches ?? []).map((match) => ({ ...match, minutes: keep(match.minutes) }));
        const teamExists = (id: string | null) =>
          !!id && ageGroups.some((group) => group.teams.some((team) => team.id === id));
        const previousTeam = saved.coachTeamId ?? null;
        const drills = withUefaDrills(saved.drills, baseline.drills);
        return {
          ...current,
          ...saved,
          clubKind: kind,
          customFormations: saved.customFormations ?? [],
          ageGroups,
          players,
          drills,
          coachTeamId: teamExists(previousTeam) ? previousTeam : null,
          boards: mergeLibraryBoards(saved.boards),
          coaches: saved.coaches ?? [],
          evaluations: keep(saved.evaluations),
          attendance: keep(saved.attendance),
          trainingMarks: keep(saved.trainingMarks),
          weeklyReports: keep(saved.weeklyReports),
          sessions: saved.sessions ?? [],
          matches,
          matchPitchColor: saved.matchPitchColor || DEFAULT_PITCH_COLOR,
          hydrated: false,
        };
      },
    },
  ),
);

export async function loadClubData(id: string, kind: "bnfc" | "custom") {
  const name = clubDataKey(id);
  useClubStore.persist.setOptions({ name });
  if (typeof window === "undefined" || !localStorage.getItem(name)) {
    useClubStore.setState({ hydrated: true, ...(kind === "bnfc" ? createSeed() : createEmptyClub()) });
    return;
  }
  await useClubStore.persist.rehydrate();
  useClubStore.setState({ hydrated: true });
}

export { isDrillLevel, isDrillType, isMoment };

export type { ClubDrill, EvaluationRecord, SessionPlan };
