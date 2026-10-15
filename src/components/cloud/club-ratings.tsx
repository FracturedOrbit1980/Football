"use client";

import { useState } from "react";

import { CloudGate, Field, Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { playerName, type Player, type Rating } from "@/lib/cloud/types";

const METRICS = ["technical", "tactical", "physical", "mental"] as const;
type Scores = Record<(typeof METRICS)[number], number>;
const DEFAULT_SCORES: Scores = { technical: 5, tactical: 5, physical: 5, mental: 5 };

export function ClubRatings() {
  return (
    <CloudGate roles={["CLUB_ADMIN", "COACH"]}>
      <RatingsScreen />
    </CloudGate>
  );
}

function RatingsScreen() {
  // RLS returns only players in the coach's own teams (or the whole club for an admin).
  const { data, error, reload, clubId } = useClubData(
    async (cloud, club) => {
      const [players, ratings] = await Promise.all([
        cloud.from("players").select("*").eq("club_id", club).not("team_id", "is", null).order("last_name"),
        cloud.from("player_ratings").select("*").eq("club_id", club).order("rated_on", { ascending: false }),
      ]);
      return { players: must<Player[]>(players), ratings: must<Rating[]>(ratings) };
    },
    { players: [] as Player[], ratings: [] as Rating[] },
  );
  const [playerId, setPlayerId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const cloud = getCloud()!;
  const player = data.players.find((item) => item.id === playerId);
  const ratings = data.ratings.filter((rating) => rating.player_id === playerId);

  async function run(action: () => PromiseLike<{ error: unknown }>, done: string) {
    setFailure("");
    const { error: problem } = await action();
    if (problem) {
      setFailure(errorText(problem));
      return false;
    }
    setNotice(done);
    reload();
    return true;
  }

  function startEdit(rating: Rating | null) {
    setEditing(rating?.id ?? null);
    setScores(rating ? { technical: rating.technical, tactical: rating.tactical, physical: rating.physical, mental: rating.mental } : DEFAULT_SCORES);
    setNotes(rating?.notes ?? "");
  }

  return (
    <>
      <Notice text={error} tone="error" />
      <Panel title="Player">
        <Select label="Player in your teams" value={playerId} onChange={(event) => { setPlayerId(event.target.value); startEdit(null); }}>
          <option value="">Choose…</option>
          {data.players.map((item) => (
            <option key={item.id} value={item.id}>{playerName(item)} · {item.player_code}</option>
          ))}
        </Select>
      </Panel>
      {player ? (
        <>
          <Panel title={editing ? "Change rating" : "New rating"}>
            <form
              className="grid gap-3 sm:grid-cols-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const row = { ...scores, notes: notes.trim() || null };
                const ok = editing
                  ? await run(() => cloud.from("player_ratings").update(row).eq("id", editing), "Rating updated.")
                  : await run(() => cloud.from("player_ratings").insert({ ...row, club_id: clubId, player_id: player.id }), "Rating saved.");
                if (ok) startEdit(null);
              }}
            >
              {METRICS.map((metric) => (
                <Field
                  key={metric}
                  label={`${metric[0].toUpperCase()}${metric.slice(1)} (1–10)`}
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={scores[metric]}
                  onChange={(event) => setScores((current) => ({ ...current, [metric]: Number(event.target.value) }))}
                />
              ))}
              <label className="block text-sm font-semibold text-slate-800 sm:col-span-4">
                Notes for the player
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-3 text-base text-slate-950" />
              </label>
              <div className="flex gap-2 sm:col-span-4">
                <Button type="submit" className="h-11">{editing ? "Save changes" : "Save rating"}</Button>
                {editing ? <Button type="button" variant="secondary" className="h-11" onClick={() => startEdit(null)}>Cancel</Button> : null}
              </div>
            </form>
            <Notice text={notice} />
            <Notice text={failure} tone="error" />
          </Panel>
          <Panel title={`Ratings for ${playerName(player)}`}>
            {ratings.length === 0 ? <p className="text-sm font-semibold text-slate-600">No ratings yet.</p> : null}
            <ul className="space-y-2">
              {ratings.map((rating) => (
                <li key={rating.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ring-1 ring-slate-200">
                  <span className="text-sm font-semibold text-slate-900">
                    {rating.rated_on} · T{rating.technical} Ta{rating.tactical} P{rating.physical} M{rating.mental}
                    {rating.notes ? ` · ${rating.notes}` : ""}
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" variant="secondary" className="h-11" onClick={() => startEdit(rating)}>Edit</Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11"
                      onClick={() => {
                        if (window.confirm("Delete this rating?")) void run(() => cloud.from("player_ratings").delete().eq("id", rating.id), "Rating deleted.");
                      }}
                    >
                      Delete
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}
    </>
  );
}
