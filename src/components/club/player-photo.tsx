"use client";

import { useState } from "react";

import { MannequinFigure } from "@/components/pitch/mannequin-figure";
import { DEFAULT_PLAYER_COLOR } from "@/lib/club/board";
import { readPlayerPhoto } from "@/lib/club/photo";

const SIZE = {
  sm: "size-11",
  md: "size-16",
  lg: "size-20",
} as const;

export function PlayerPortrait({
  photo,
  name,
  size = "md",
}: {
  photo?: string;
  name: string;
  size?: keyof typeof SIZE;
}) {
  const box = SIZE[size];
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        data-player-photo="image"
        className={`${box} shrink-0 rounded-full bg-white object-cover ring-1 ring-slate-300`}
      />
    );
  }
  return (
    <svg
      viewBox="-1.6 -2.2 3.2 3.8"
      data-player-photo="figure"
      aria-hidden="true"
      className={`${box} shrink-0 rounded-full bg-emerald-700 ring-1 ring-slate-300`}
    >
      <MannequinFigure fill={DEFAULT_PLAYER_COLOR} ring="#ffffff" label="" />
      <title>{name ? `${name} has no picture` : "No picture"}</title>
    </svg>
  );
}

export function PlayerPhotoField({
  photo,
  name,
  field,
  onPhoto,
}: {
  photo?: string;
  name: string;
  field: string;
  onPhoto: (photo: string) => void;
}) {
  const [notice, setNotice] = useState("");
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Picture</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <PlayerPortrait photo={photo} name={name} />
        <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700">
          Choose a picture
          <input
            type="file"
            accept="image/*"
            data-field={field}
            className="mt-1 block w-full max-w-full text-base file:mr-3 file:inline-flex file:min-h-11 file:items-center file:rounded-md file:px-3 file:font-bold"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void readPlayerPhoto(file)
                .then((next) => {
                  setNotice("");
                  onPhoto(next);
                })
                .catch(() => setNotice("Use an image under 2 MB."));
            }}
          />
        </label>
      </div>
      {notice ? <p className="mt-2 text-sm font-semibold text-slate-700">{notice}</p> : null}
    </div>
  );
}
