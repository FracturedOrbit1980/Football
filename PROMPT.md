# SYSTEM SPECIFICATION: CLUBSTRIDE APPLICATION PLATFORM

## 1. PROJECT OVERVIEW & GOALS
Build a multi-tenant, role-based Progressive Web App (PWA) named Football, for the Clubstride club. 
The application manages a hierarchical club pipeline from grassroots to competitive youth squads.

### Primary Objectives:
- **Responsive Architecture:** Seamless desktop experience for admin/planning; fast, pitch-side UI for mobile devices.
- **Hierarchical Access Control (RBAC):** Strict permissions separating Club Admins, Team Coaches, and Individual Players.
- **Pitch-Side Utilities:** Live match substitution tracker with real-time minutes played counters, and an interactive drill stopwatch.
- **Framework Agnostic Content:** Drill and evaluation metrics must remain flexible and modular, allowing standard custom inputs without hardcoded governing-body titles.

## 2. RECOMMENDED TECH STACK
- **Framework:** Next.js (App Router, React 19 / TypeScript)
- **Styling:** Tailwind CSS + Lucide React (Icons)
- **State Management:** Zustand (for real-time timers and live match state)
- **Database / Backend:** Supabase (PostgreSQL + Auth + Row Level Security) or Firebase
- **UI Components:** Shadcn UI / Radix Primitives

## 3. ROLE-BASED ACCESS CONTROL (RBAC) & DATA BOUNDARIES

| Role Identifier | Scope & Boundary | Capabilities & Views |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Global (Entire Club) | Full view of all age groups, teams, coaches, player profiles, global analytics, and official club drill library management. |
| `HEAD_COACH` | Assigned `team_id`(s) | View team roster, plan session drills, run pitch-side drill stopwatch, manage live match substitutions/minutes, rate player metrics. |
| `PLAYER` | Assigned `player_id` | Read-only view of personal profile, developmental radar graphs, match attendance, and assigned homework/notes. |

## 4. DATABASE SCHEMA (POSTGRESQL / SUPABASE DDL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Roles Enum
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'HEAD_COACH', 'PLAYER');

-- 1. CLUBS
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Clubstride',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AGE GROUPS
CREATE TABLE age_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- e.g., "Under 13"
    display_order INT NOT NULL
);

-- 3. TEAMS / SUBDIVISIONS
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    age_group_id UUID REFERENCES age_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "U13 Premier", "U13 Academy"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. USERS & PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'PLAYER',
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PLAYER DETAILS
CREATE TABLE player_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    squad_number INT,
    preferred_position VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. DRILL REPOSITORY
CREATE TABLE drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    is_club_official BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_age_group VARCHAR(50),
    objective_category VARCHAR(100), -- Technical, Tactical, Physical, Set Piece
    diagram_url TEXT,
    pitch_setup TEXT,
    instructions TEXT,
    coaching_points TEXT[],
    default_duration_seconds INT DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. PLAYER EVALUATION METRICS (FOR RADAR GRAPHS)
CREATE TABLE player_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES player_details(id) ON DELETE CASCADE,
    evaluated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    technical_score INT CHECK (technical_score BETWEEN 1 AND 10),
    tactical_score INT CHECK (tactical_score BETWEEN 1 AND 10),
    physical_score INT CHECK (physical_score BETWEEN 1 AND 10),
    mental_score INT CHECK (mental_score BETWEEN 1 AND 10),
    notes TEXT
);

-- 8. MATCH LOGS & MINUTES
CREATE TABLE match_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    opponent VARCHAR(255) NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'SCHEDULED' -- SCHEDULED, LIVE, COMPLETED
);

CREATE TABLE match_player_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES match_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES player_details(id) ON DELETE CASCADE,
    minutes_played NUMERIC(5,2) DEFAULT 0.0,
    is_on_pitch BOOLEAN DEFAULT FALSE
);
```

## 5. ZUSTAND MATCH STORE

```ts
import { create } from 'zustand';
export interface PlayerMatchState {
  playerId: string;
  name: string;
  squadNumber: number;
  position: string;
  isOnPitch: boolean;
  minutesPlayed: number;
}
interface MatchStore {
  matchTimeSeconds: number;
  isClockRunning: boolean;
  players: PlayerMatchState[];
  startMatchClock: () => void;
  pauseMatchClock: () => void;
  substitutePlayer: (playerOffId: string, playerOnId: string) => void;
  tickSecond: () => void;
}
export const useMatchStore = create<MatchStore>((set, get) => ({
  matchTimeSeconds: 0,
  isClockRunning: false,
  players: [],
  startMatchClock: () => set({ isClockRunning: true }),
  pauseMatchClock: () => set({ isClockRunning: false }),
  substitutePlayer: (playerOffId, playerOnId) =>
    set((state) => ({
      players: state.players.map((p) => {
        if (p.playerId === playerOffId) return { ...p, isOnPitch: false };
        if (p.playerId === playerOnId) return { ...p, isOnPitch: true };
        return p;
      }),
    })),
  tickSecond: () =>
    set((state) => ({
      matchTimeSeconds: state.matchTimeSeconds + 1,
      players: state.players.map((p) =>
        p.isOnPitch ? { ...p, minutesPlayed: p.minutesPlayed + 1 / 60 } : p
      ),
    })),
}));
```

## 6. DRILL STOPWATCH COMPONENT

```tsx
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
export function DrillStopwatch({ drillTitle, targetSeconds = 300 }: { drillTitle: string; targetSeconds?: number }) {
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds);
  const [isActive, setIsActive] = useState(false);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, secondsLeft]);
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  return (
    <div className="p-4 bg-slate-900 text-white rounded-xl shadow-lg max-w-md mx-auto">
      <h3 className="text-lg font-bold text-slate-200">{drillTitle}</h3>
      <div className="my-6 text-center text-6xl font-mono tracking-wider text-emerald-400">
        {formatTime(secondsLeft)}
      </div>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setIsActive(!isActive)}
          className={`p-4 rounded-full font-bold flex items-center justify-center ${
            isActive ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        >
          {isActive ? <Pause className="w-8 h-8"/> : <Play className="w-8 h-8"/>}
        </button>
        <button
          onClick={() => { setIsActive(false); setSecondsLeft(targetSeconds); }}
          className="p-4 bg-slate-700 hover:bg-slate-600 rounded-full"
        >
          <RotateCcw className="w-8 h-8"/>
        </button>
      </div>
    </div>
  );
}
```

## 7. IMPLEMENTATION SEQUENCE (this task is the first slice only)
1. Setup core app architecture: Next.js, Tailwind, Shadcn UI, global layout with dynamic navbar (desktop sidebar vs mobile bottom bar).
2. Database and auth layer stubs: Supabase browser/server clients from env vars, TypeScript types matching the schema, SQL migration file, middleware skeleton that will protect /admin, /coach, and /player by role. Do not require live Supabase credentials for the app to build. Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
3. Dynamic component shells:
   - components/dashboard/: player radar chart using Recharts (can use sample scores).
   - components/match/: live match tracker shell using the Zustand store (pitch vs bench, click-to-substitute, clock). Include a small demo roster so the UI is usable without a backend.
   - components/drills/: drill library grid shell (filter by objective category) plus the DrillStopwatch.
4. Route groups:
   - / admin area for SUPER_ADMIN
   - /coach for HEAD_COACH (roster, drills, match tracker)
   - /player for PLAYER (profile, radar, attendance placeholder)
   A simple home/login placeholder is fine. Role switching for the demo can be a local dev control if auth is not wired to a real project yet — label it clearly as demo-only.

PWA: add a minimal web app manifest and metadata so it is installable later. Product name: Football. Club name: Clubstride.

Club visual tone: football club, clean, high contrast, readable in sunlight on a phone. Emerald/slate is fine as a starting palette.

## Out of scope for this slice
- Real Supabase project provisioning
- Full RLS policies beyond a commented SQL stub
- Production auth provider setup
- Committing or opening a PR

## Report back
List created routes, key files, how to run the dev server, and anything blocked (missing credentials, build errors you could not fix).
