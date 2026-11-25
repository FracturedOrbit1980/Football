"use client";

import { useState } from "react";

import { BACKDROP_BUCKET, LOGO_BUCKET, useBranding } from "@/components/cloud/branding";
import { CloudGate, Field, Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { PLACEMENT_LABEL, SPONSOR_PLACEMENTS, type Sponsor, type SponsorPlacement } from "@/lib/cloud/types";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";

export function ClubSponsors() {
  return (
    <CloudGate roles={["CLUB_ADMIN"]}>
      <SponsorsScreen />
    </CloudGate>
  );
}

function extension(file: File) {
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

async function upload(bucket: string, clubId: string, folder: string, file: File) {
  // Paths always start with the club id; storage policies only allow the club's own admins.
  const path = `${clubId}/${folder}/${crypto.randomUUID()}.${extension(file)}`;
  const { error } = await getCloud()!.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

function SponsorsScreen() {
  const brand = useBranding();
  const { data, error, reload, clubId } = useClubData(
    async (cloud, club) => ({ sponsors: must<Sponsor[]>(await cloud.from("sponsors").select("*").eq("club_id", club).order("sort_order")) }),
    { sponsors: [] as Sponsor[] },
  );
  const cloud = getCloud()!;
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [form, setForm] = useState({ name: "", website: "", placement: "HEADER" as SponsorPlacement, file: null as File | null });
  const [opacity, setOpacity] = useState<number | null>(null);
  const shownOpacity = opacity ?? brand.watermarkOpacity;

  async function attempt(work: () => Promise<void>, done: string) {
    setFailure("");
    try {
      await work();
      setNotice(done);
      reload();
      brand.reload();
    } catch (problem) {
      setFailure(errorText(problem));
    }
  }

  async function setBrandFile(column: "logo_path" | "watermark_path" | "backdrop_path", file: File | undefined) {
    if (!file || !clubId) return;
    await attempt(async () => {
      const bucket = column === "logo_path" ? LOGO_BUCKET : BACKDROP_BUCKET;
      const path = await upload(bucket, clubId, "branding", file);
      const old = brand.branding?.[column];
      const { error: problem } = await cloud.from("club_branding").upsert({ club_id: clubId, [column]: path, updated_at: new Date().toISOString() });
      if (problem) throw problem;
      if (old) await cloud.storage.from(bucket).remove([old]);
    }, "Branding updated.");
  }

  return (
    <>
      <Notice text={error} tone="error" />
      <Notice text={notice} />
      <Notice text={failure} tone="error" />
      <Panel title="Club branding">
        <p className="mb-3 text-sm font-medium text-slate-700">
          Files are private to this club. The watermark sits on the live-match pitch and the drill and tactics boards; the
          backdrop sits faintly behind the app.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["logo_path", "Club logo", brand.logoUrl],
              ["watermark_path", "Pitch watermark", brand.watermarkUrl],
              ["backdrop_path", "App backdrop", brand.backdropUrl],
            ] as const
          ).map(([column, label, url]) => (
            <div key={column} className="space-y-2">
              <p className="text-sm font-bold text-slate-800">{label}</p>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-24 w-full rounded-md bg-slate-100 object-contain" />
              ) : (
                <p className="grid h-24 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">None</p>
              )}
              <input type="file" accept={IMAGE_TYPES} aria-label={`Upload ${label}`} onChange={(event) => setBrandFile(column, event.target.files?.[0])} className="block w-full text-sm" />
            </div>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Watermark strength {Math.round(shownOpacity * 100)}%
          <input type="range" min={0} max={0.5} step={0.01} value={shownOpacity} onChange={(event) => setOpacity(Number(event.target.value))} className="mt-1 block w-full" />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="mt-2 h-11"
          onClick={() =>
            attempt(async () => {
              const { error: problem } = await cloud.from("club_branding").upsert({ club_id: clubId, watermark_opacity: shownOpacity });
              if (problem) throw problem;
            }, "Watermark strength saved.")
          }
        >
          Save strength
        </Button>
        <ClubColours clubId={clubId ?? ""} />
      </Panel>

      <Panel title="Add a sponsor">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void attempt(async () => {
              const logoPath = form.file && clubId ? await upload(LOGO_BUCKET, clubId, "sponsors", form.file) : null;
              const { error: problem } = await cloud.from("sponsors").insert({
                club_id: clubId,
                name: form.name.trim(),
                website: form.website.trim() || null,
                placement: form.placement,
                logo_path: logoPath,
                sort_order: data.sponsors.length,
              });
              if (problem) throw problem;
              setForm({ name: "", website: "", placement: "HEADER", file: null });
            }, "Sponsor added.");
          }}
        >
          <Field label="Sponsor name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Field label="Website (https://…)" type="url" pattern="https://.*" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          <Select label="Placement" value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value as SponsorPlacement })}>
            {SPONSOR_PLACEMENTS.map((placement) => (
              <option key={placement} value={placement}>{PLACEMENT_LABEL[placement]}</option>
            ))}
          </Select>
          <label className="block text-sm font-semibold text-slate-800">
            Logo
            <input type="file" accept={IMAGE_TYPES} onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} className="mt-2 block w-full text-sm" />
          </label>
          <Button type="submit" className="h-11 sm:col-span-2">Add sponsor</Button>
        </form>
      </Panel>

      <Panel title={`Sponsors (${data.sponsors.length})`}>
        <ul className="space-y-2">
          {data.sponsors.map((sponsor) => (
            <li key={sponsor.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ring-1 ring-slate-200">
              <span className="text-sm font-semibold text-slate-900">
                {sponsor.name} · {PLACEMENT_LABEL[sponsor.placement]} · {sponsor.active ? "Active" : "Paused"}
              </span>
              <span className="flex gap-2">
                <Button type="button" variant="secondary" className="h-11" onClick={() => attempt(async () => {
                  const { error: problem } = await cloud.from("sponsors").update({ active: !sponsor.active }).eq("id", sponsor.id);
                  if (problem) throw problem;
                }, sponsor.active ? "Sponsor paused." : "Sponsor active.")}>
                  {sponsor.active ? "Pause" : "Activate"}
                </Button>
                <Button type="button" variant="destructive" className="h-11" onClick={() => {
                  if (!window.confirm(`Remove ${sponsor.name}?`)) return;
                  void attempt(async () => {
                    const { error: problem } = await cloud.from("sponsors").delete().eq("id", sponsor.id);
                    if (problem) throw problem;
                    if (sponsor.logo_path) await cloud.storage.from(LOGO_BUCKET).remove([sponsor.logo_path]);
                  }, "Sponsor removed.");
                }}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function ClubColours({ clubId }: { clubId: string }) {
  const { branding, reload } = useBranding();
  const [primary, setPrimary] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const shownPrimary = primary ?? branding?.primary_color ?? "#d16b6f";
  const shownAccent = accent ?? branding?.accent_color ?? "#f8d058";
  return (
    <div className="mt-4 border-t border-slate-200 pt-4" data-club-colours>
      <p className="text-sm font-bold text-slate-900">Club colours</p>
      <p className="text-xs font-medium text-slate-600">Used for buttons, highlights and the menu for everyone in this club.</p>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <label className="text-sm font-semibold text-slate-800">
          Main colour
          <input type="color" aria-label="Main colour" value={shownPrimary} onChange={(event) => setPrimary(event.target.value)} className="mt-1 block h-11 w-20" />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Accent colour
          <input type="color" aria-label="Accent colour" value={shownAccent} onChange={(event) => setAccent(event.target.value)} className="mt-1 block h-11 w-20" />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="h-11"
          onClick={async () => {
            const { error } = await getCloud()!
              .from("club_branding")
              .upsert({ club_id: clubId, primary_color: shownPrimary, accent_color: shownAccent, updated_at: new Date().toISOString() });
            setMessage(error ? errorText(error) : "Club colours saved.");
            if (!error) reload();
          }}
        >
          Save colours
        </Button>
      </div>
      {message ? <p className="mt-2 text-sm font-semibold text-slate-800">{message}</p> : null}
    </div>
  );
}
