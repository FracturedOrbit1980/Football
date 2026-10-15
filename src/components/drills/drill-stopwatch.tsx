"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useReducer } from "react";

import { Button } from "@/components/ui/button";

type TimerState = {
  /** Remaining milliseconds banked while paused. */
  remainingMs: number;
  /** Wall-clock ms when the running block finishes, or null while paused. */
  endsAt: number | null;
  /** Last time the display was refreshed; only used to trigger re-renders. */
  now: number;
  drillKey: string;
};

type TimerAction =
  | { type: "tick"; now: number }
  | { type: "toggle"; now: number }
  | { type: "reset"; targetSeconds: number }
  | { type: "load"; drillKey: string; targetSeconds: number };

function remainingAt(state: TimerState, now: number) {
  return state.endsAt === null ? state.remainingMs : Math.max(0, state.endsAt - now);
}

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "tick": {
      if (state.endsAt === null) return state;
      const left = remainingAt(state, action.now);
      if (left === 0) return { ...state, endsAt: null, remainingMs: 0, now: action.now };
      return { ...state, now: action.now };
    }
    case "toggle": {
      if (state.endsAt !== null) {
        return { ...state, endsAt: null, remainingMs: remainingAt(state, action.now), now: action.now };
      }
      if (state.remainingMs <= 0) return state;
      return { ...state, endsAt: action.now + state.remainingMs, now: action.now };
    }
    case "reset":
      return { ...state, endsAt: null, remainingMs: action.targetSeconds * 1000 };
    case "load":
      return { drillKey: action.drillKey, endsAt: null, remainingMs: action.targetSeconds * 1000, now: 0 };
    default:
      return state;
  }
}

const MIN_SECONDS = 15;
const MAX_SECONDS = 30 * 60;

function clampSeconds(total: number) {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(total)));
}

export function DrillStopwatch({
  drillTitle,
  targetSeconds = 300,
  suggestedSeconds,
  onTargetSecondsChange,
}: {
  drillTitle: string;
  targetSeconds?: number;
  suggestedSeconds?: number;
  onTargetSecondsChange?: (seconds: number) => void;
}) {
  const drillKey = `${drillTitle}:${targetSeconds}`;
  const [state, dispatch] = useReducer(timerReducer, {
    remainingMs: targetSeconds * 1000,
    endsAt: null,
    now: 0,
    drillKey,
  });
  const isActive = state.endsAt !== null;
  const secondsLeft = Math.ceil((isActive ? Math.max(0, (state.endsAt ?? 0) - state.now) : state.remainingMs) / 1000);

  if (state.drillKey !== drillKey) {
    dispatch({ type: "load", drillKey, targetSeconds });
  }

  // Remaining time comes from the end timestamp, so throttled timers on a locked phone lose nothing.
  useEffect(() => {
    if (!isActive) return;
    const tick = () => dispatch({ type: "tick", now: Date.now() });
    const interval = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isActive]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const suggested = suggestedSeconds ?? targetSeconds;
  const minutes = Math.floor(targetSeconds / 60);
  const seconds = targetSeconds % 60;

  function setBlock(next: number) {
    if (isActive) return;
    onTargetSecondsChange?.(clampSeconds(next));
  }

  return (
    <div className="ink-panel w-full rounded-xl bg-slate-900 p-4 text-white shadow-lg">
      <h3 className="text-lg font-bold text-slate-200">{drillTitle}</h3>
      <p className="mt-1 text-sm font-medium text-slate-300">
        {secondsLeft === 0 ? "Block complete" : isActive ? "Running" : "Ready"}
      </p>
      <div className="my-4 text-center font-mono text-6xl tracking-wider text-emerald-400">
        {formatTime(secondsLeft)}
      </div>
      <div className="mb-4 rounded-lg bg-slate-800 p-3">
        <p className="text-center text-xs font-bold uppercase tracking-wide text-amber-300">Set your time</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <TimeStep label="-1 min" onClick={() => setBlock(targetSeconds - 60)} disabled={isActive} />
          <TimeStep label="-15s" onClick={() => setBlock(targetSeconds - 15)} disabled={isActive} />
          <label className="text-center text-xs font-semibold text-slate-300">
            Min
            <input
              aria-label="Block minutes"
              type="number"
              min={0}
              max={30}
              disabled={isActive}
              value={minutes}
              onChange={(event) => {
                const nextMinutes = Number(event.target.value);
                if (Number.isNaN(nextMinutes)) return;
                setBlock(nextMinutes * 60 + seconds);
              }}
              className="mt-1 block h-11 w-16 rounded-md bg-white text-center text-lg font-bold text-slate-950"
            />
          </label>
          <label className="text-center text-xs font-semibold text-slate-300">
            Sec
            <input
              aria-label="Block seconds"
              type="number"
              min={0}
              max={59}
              disabled={isActive}
              value={seconds}
              onChange={(event) => {
                const nextSeconds = Number(event.target.value);
                if (Number.isNaN(nextSeconds)) return;
                setBlock(minutes * 60 + nextSeconds);
              }}
              className="mt-1 block h-11 w-16 rounded-md bg-white text-center text-lg font-bold text-slate-950"
            />
          </label>
          <TimeStep label="+15s" onClick={() => setBlock(targetSeconds + 15)} disabled={isActive} />
          <TimeStep label="+1 min" onClick={() => setBlock(targetSeconds + 60)} disabled={isActive} />
        </div>
        {suggested !== targetSeconds ? (
          <button
            type="button"
            disabled={isActive}
            onClick={() => setBlock(suggested)}
            className="mt-2 w-full text-sm font-semibold text-emerald-300 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Use suggested {formatTime(suggested)}
          </button>
        ) : (
          <p className="mt-2 text-center text-xs font-medium text-slate-400">Suggested {formatTime(suggested)}</p>
        )}
      </div>
      <div className="flex justify-center gap-4">
        <Button
          type="button"
          size="icon-lg"
          aria-label={isActive ? "Pause drill" : "Start drill"}
          onClick={() => dispatch({ type: "toggle", now: Date.now() })}
          className="size-16 rounded-full"
        >
          {isActive ? <Pause className="size-8" /> : <Play className="size-8" />}
        </Button>
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          aria-label="Reset drill timer"
          onClick={() => dispatch({ type: "reset", targetSeconds })}
          className="size-16 rounded-full"
        >
          <RotateCcw className="size-8" />
        </Button>
      </div>
    </div>
  );
}

function TimeStep({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={onClick}
      className="h-11 px-3 text-sm"
    >
      {label}
    </Button>
  );
}
