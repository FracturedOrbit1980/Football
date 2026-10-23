"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { parseRoster } from "@/lib/club/roster";
import { useClubStore } from "@/stores/club-store";

export function PlayerUpload() {
  const importPlayers = useClubStore((state) => state.importPlayers);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");

  function apply(raw: string) {
    const { rows, errors } = parseRoster(raw);
    if (rows.length === 0) {
      setNotice(errors[0] ?? "No players found. Each line needs a name and shirt number.");
      return;
    }
    const result = importPlayers(rows);
    const summary = [
      result.added ? `Added ${result.added} ${result.added === 1 ? "player" : "players"}` : "",
      result.updated ? `Updated ${result.updated} ${result.updated === 1 ? "player" : "players"}` : "",
    ].filter(Boolean);
    const skipped = errors.length ? ` Skipped ${errors.length} ${errors.length === 1 ? "line" : "lines"}.` : "";
    setNotice(`${summary.join(". ")}. Each one gets a registration reference and waits for the head coach to allocate them to a team.${skipped}`);
  }

  return (
    <form
      className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-300"
      onSubmit={(event) => {
        event.preventDefault();
        apply(text);
      }}
    >
      <h2 className="text-lg font-bold text-slate-950">Upload a registration list</h2>
      <p className="text-sm font-medium text-slate-700">
        Paste a list or choose a file. Each line is the player name and shirt number. New players get a registration reference but no team yet, ready for the head coach.
      </p>
      <textarea
        value={text}
        data-field="player-upload"
        onChange={(event) => setText(event.target.value)}
        placeholder={"HUDSON ANTHONY MINNIE\t4"}
        className="h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="h-11">
          Upload players
        </Button>
        <label className="text-sm font-semibold text-slate-800">
          File
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            data-field="player-upload-file"
            className="mt-1 block w-full text-base file:mr-3 file:h-11 file:rounded-md file:px-3 file:font-bold"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((contents) => {
                setText(contents);
                apply(contents);
              });
            }}
          />
        </label>
      </div>
      {notice ? <p className="text-sm font-semibold text-slate-800">{notice}</p> : null}
    </form>
  );
}
