import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ageNumber, ensureYouthAges, sortByAge } from "@/lib/club/age";
import { isIsoDate, todayIso } from "@/lib/club/accounting";
import { normalizePositions } from "@/lib/club/positions";
import { canonicalDivision, canonicalTeamName, type Division, type DrillLevel, type DrillType, type MomentOfGame, type PlayerCount, type SetupDiagram } from "@/lib/club/catalog";
import { isDrillLevel, isDrillType, isMoment, skillOf, withUefaDrills, youthAgeOf } from "@/lib/club/drill-record";
import { DEFAULT_PITCH_COLOR, type DrillBoard } from "@/lib/club/board";
import { mergeLibraryBoards } from "@/lib/club/library-boards";
import { placeOnU12Prem, playerId, SQUAD_TEAM_ID, type RosterRow } from "@/lib/club/roster";
import { weekDates } from "@/lib/club/week";
import { clubDataKey } from "@/lib/club/registry";
import {
  createEmptyClub,
  createSeed,
  type AttendanceRecord,
  type ClubData,
  type ClubDrill,
  type EvaluationRecord,
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
  setPlayerAccount: (
    playerId: string,
    input: { seasonFee: number; feeDueDate: string; guardianName: string; guardianEmail: string },
  ) => void;
  recordPayment: (playerId: string, amount: number, date: string) => void;
  removePayment: (playerId: string, paymentId: string) => void;
  setPlayerPin: (playerId: string, pin: string) => void;
  deletePlayer: (playerId: string) => void;
  addCoach: (teamId: string, name: string) => void;
  addEvaluation: (input: NewEvaluationInput) => void;
  setHomework: (playerId: string, homework: string) => void;
  setTeamGameDay: (teamId: string, gameDay: string) => void;
  setTrainingAttendance: (playerId: string, date: string, present: boolean) => void;
  saveWeeklyReport: (playerId: string, teamId: string, weekStart: string, gameFeedback: string) => void;
  saveSession: (teamId: string, title: string, drillIds: string[]) => void;
  saveMatch: (teamId: string, opponent: string, minutes: { playerId: string; minutesPlayed: number }[]) => void;
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
              seasonFee: 0,
              feeDueDate: "",
              payments: [],
              guardianName: "",
              guardianEmail: "",
              accessPin: "",
            },
          ],
        })),
      importPlayers: (rows) => {
        const players = [...get().players];
        let added = 0;
        let updated = 0;
        for (const row of rows) {
          const name = row.name.trim().replace(/\s+/g, " ");
          const index = players.findIndex((player) => player.name.trim().toLowerCase() === name.toLowerCase());
          if (index >= 0) {
            players[index] = { ...players[index], name, squadNumber: row.squadNumber };
            updated += 1;
          } else {
            const id = playerId(name);
            players.push({
              id: players.some((player) => player.id === id) ? `${id}-${Date.now()}` : id,
              name,
              squadNumber: row.squadNumber,
              position: "Central midfielder",
              positions: [],
              teamId: "",
              homework: "",
              photo: "",
              seasonFee: 0,
              feeDueDate: "",
              payments: [],
              guardianName: "",
              guardianEmail: "",
              accessPin: "",
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
      setPlayerAccount: (playerId, input) =>
        set((state) => ({
          players: state.players.map((player) => {
            if (player.id !== playerId) return player;
            const seasonFee = Math.max(0, Math.round(Number.isFinite(input.seasonFee) ? input.seasonFee : 0));
            return {
              ...player,
              seasonFee,
              feeDueDate: isIsoDate(input.feeDueDate) ? input.feeDueDate : seasonFee > 0 ? todayIso() : "",
              guardianName: input.guardianName.trim().slice(0, 80),
              guardianEmail: input.guardianEmail.trim().slice(0, 120),
            };
          }),
        })),
      recordPayment: (playerId, amount, date) =>
        set((state) => ({
          players: state.players.map((player) => {
            if (player.id !== playerId) return player;
            const value = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
            if (value === 0) return player;
            return {
              ...player,
              payments: [
                ...player.payments,
                { id: `pay-${Date.now()}`, date: isIsoDate(date) ? date : todayIso(), amount: value },
              ],
            };
          }),
        })),
      removePayment: (playerId, paymentId) =>
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId
              ? { ...player, payments: player.payments.filter((payment) => payment.id !== paymentId) }
              : player,
          ),
        })),
      setPlayerPin: (playerId, pin) =>
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId
              ? { ...player, accessPin: pin.replace(/\D/g, "").slice(0, 4) }
              : player,
          ),
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
      saveMatch: (teamId, opponent, minutes) =>
        set((state) => {
          const playedOn = todayLabel();
          const match: SavedMatch = {
            id: `match-${Date.now()}`,
            teamId,
            opponent,
            playedOn,
            minutes,
          };
          const attendance: AttendanceRecord[] = minutes.map((row) => ({
            id: `att-${match.id}-${row.playerId}`,
            playerId: row.playerId,
            when: playedOn,
            detail: `vs ${opponent}`,
            status: row.minutesPlayed > 0 ? "Present" : "Absent",
          }));
          return {
            matches: [match, ...state.matches],
            attendance: [...attendance, ...state.attendance],
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
        const useSquad = kind === "bnfc" && savedPlayers.length === 0;
        const ageGroups = ensureYouthAges(saved.ageGroups ?? baseline.ageGroups).map((group) => ({
          ...group,
          teams: (group.teams ?? []).map((team) => ({
            ...team,
            name: canonicalTeamName(team.name ?? ""),
            division: canonicalDivision(team.division) ?? canonicalDivision(team.name),
          })),
        }));
        const players = (useSquad ? baseline.players : savedPlayers).map((player) => {
          const next = { ...player } as typeof player & { dateOfBirth?: string; feePaid?: number };
          delete next.dateOfBirth;
          const legacyPaid =
            typeof next.feePaid === "number" && Number.isFinite(next.feePaid)
              ? Math.max(0, Math.round(next.feePaid))
              : 0;
          delete next.feePaid;
          const payments = Array.isArray(player.payments)
            ? player.payments
                .filter((payment) => payment && Number.isFinite(payment.amount))
                .map((payment, index) => ({
                  id: typeof payment.id === "string" && payment.id ? payment.id : `pay-${index}`,
                  date: isIsoDate(payment.date) ? payment.date : todayIso(),
                  amount: Math.max(0, Math.round(payment.amount)),
                }))
                .filter((payment) => payment.amount > 0)
            : legacyPaid > 0
              ? [
                  {
                    id: "pay-legacy",
                    date: isIsoDate(player.feeDueDate) ? player.feeDueDate : todayIso(),
                    amount: legacyPaid,
                  },
                ]
              : [];
          return {
            ...next,
            ...normalizePositions(player.position, player.positions),
            photo: typeof player.photo === "string" ? player.photo : "",
            seasonFee:
              typeof player.seasonFee === "number" && Number.isFinite(player.seasonFee)
                ? Math.max(0, Math.round(player.seasonFee))
                : 0,
            feeDueDate: isIsoDate(player.feeDueDate) ? player.feeDueDate : "",
            payments,
            guardianName: typeof player.guardianName === "string" ? player.guardianName.slice(0, 80) : "",
            guardianEmail: typeof player.guardianEmail === "string" ? player.guardianEmail.slice(0, 120) : "",
            accessPin:
              typeof player.accessPin === "string" ? player.accessPin.replace(/\D/g, "").slice(0, 4) : "",
          };
        });
        const placed = placeOnU12Prem(ageGroups, players);
        const previousTeam = saved.coachTeamId ?? null;
        const previousGroup = placed.ageGroups.find((group) => group.teams.some((team) => team.id === previousTeam));
        const openPrem =
          kind === "bnfc" &&
          (!previousTeam ||
            previousTeam === SQUAD_TEAM_ID ||
            previousTeam === placed.teamId ||
            (previousGroup ? ageNumber(previousGroup.name) === 12 : true));
        const drills = withUefaDrills(saved.drills, baseline.drills);
        return {
          ...current,
          ...saved,
          clubKind: kind,
          customFormations: saved.customFormations ?? [],
          ageGroups: kind === "custom" ? ageGroups : placed.ageGroups,
          players: kind === "custom" ? players : placed.players,
          drills,
          coachTeamId: kind === "custom" ? previousTeam : openPrem ? placed.teamId : previousTeam,
          boards: mergeLibraryBoards(saved.boards),
          coaches: saved.coaches ?? [],
          evaluations: saved.evaluations ?? [],
          attendance: saved.attendance ?? [],
          trainingMarks: saved.trainingMarks ?? [],
          weeklyReports: saved.weeklyReports ?? [],
          sessions: saved.sessions ?? [],
          matches: saved.matches ?? [],
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
