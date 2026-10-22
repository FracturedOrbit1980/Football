"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DrillVideo({
  videoUrl,
  onAttach,
}: {
  videoUrl: string;
  onAttach: (url: string, name: string) => void;
}) {
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <div className="min-w-0 space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-300">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Video</h3>
      <label className="block text-sm font-semibold text-slate-800">
        Video link
        <input
          value={link}
          data-field="video-url"
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://…"
          className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
        />
      </label>
      <Button
        type="button"
        size="lg"
        className="h-11"
        onClick={() => {
          const next = link.trim();
          if (!next) {
            setNotice("Paste a video link or choose a file.");
            return;
          }
          onAttach(next, "Link");
          setLink("");
          setNotice("Video attached.");
        }}
      >
        Attach link
      </Button>
      <label className="block text-sm font-semibold text-slate-800">
        Video file
        <input
          type="file"
          accept="video/*"
          data-field="video-file"
          className="mt-1 block w-full text-base file:mr-3 file:h-11 file:rounded-md file:px-3 file:font-bold"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === "string" ? reader.result : "";
              if (!result) return;
              onAttach(result, file.name);
              setNotice("Video attached.");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {videoUrl ? (
        <video data-drill-video controls src={videoUrl} className="mt-1 w-full max-w-md rounded-lg bg-[#0b1b33]" />
      ) : (
        <p className="text-sm font-semibold text-slate-700">No video yet.</p>
      )}
      {notice ? <p className="text-sm font-semibold text-slate-800">{notice}</p> : null}
    </div>
  );
}
