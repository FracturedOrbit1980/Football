"use client";

import { useEffect, useState } from "react";

import { Field, Notice, Panel } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { playerName, type Player } from "@/lib/cloud/types";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

type Settings = {
  responsible_party: string;
  physical_address: string;
  info_officer_name: string;
  info_officer_email: string;
  info_officer_phone: string;
  hosting_region: string;
  retention_months: string;
};

type DataRequest = {
  id: string;
  player_id: string;
  kind: string;
  details: string | null;
  status: string;
  created_at: string;
};

const EMPTY: Settings = {
  responsible_party: "",
  physical_address: "",
  info_officer_name: "",
  info_officer_email: "",
  info_officer_phone: "",
  hosting_region: "",
  retention_months: "24",
};

/** Club admin: POPIA notice details and data subject requests. */
export function ClubPrivacyAdmin() {
  const { data, error, reload, clubId } = useClubData(
    async (cloud, club) => {
      const [privacy, requests, players] = await Promise.all([
        cloud.from("club_privacy").select("*").eq("club_id", club).maybeSingle(),
        cloud.from("data_requests").select("*").eq("club_id", club).order("created_at", { ascending: false }),
        cloud.from("players").select("*").eq("club_id", club),
      ]);
      if (privacy.error) throw privacy.error;
      return {
        privacy: privacy.data as Record<string, unknown> | null,
        requests: must<DataRequest[]>(requests),
        players: must<Player[]>(players),
      };
    },
    { privacy: null as Record<string, unknown> | null, requests: [] as DataRequest[], players: [] as Player[] },
  );
  const [form, setForm] = useState<Settings>(EMPTY);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    const row = data.privacy;
    if (!row) return;
    // Copy the saved settings into the editable form when they load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      responsible_party: String(row.responsible_party ?? ""),
      physical_address: String(row.physical_address ?? ""),
      info_officer_name: String(row.info_officer_name ?? ""),
      info_officer_email: String(row.info_officer_email ?? ""),
      info_officer_phone: String(row.info_officer_phone ?? ""),
      hosting_region: String(row.hosting_region ?? ""),
      retention_months: String(row.retention_months ?? "24"),
    });
  }, [data.privacy]);

  const set = (key: keyof Settings) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const cloud = getCloud()!;
  const who = (id: string) => {
    const player = data.players.find((row) => row.id === id);
    return player ? `${playerName(player)} (${player.player_code})` : "Deleted player";
  };

  return (
    <>
      <Panel title="Privacy notice (POPIA)">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setFailure("");
            const { error: problem } = await cloud.from("club_privacy").upsert({
              club_id: clubId,
              responsible_party: form.responsible_party || null,
              physical_address: form.physical_address || null,
              info_officer_name: form.info_officer_name || null,
              info_officer_email: form.info_officer_email || null,
              info_officer_phone: form.info_officer_phone || null,
              hosting_region: form.hosting_region || "Supabase project region (set by the club)",
              retention_months: Number(form.retention_months) || 24,
              policy_version: PRIVACY_POLICY_VERSION,
              updated_at: new Date().toISOString(),
            });
            if (problem) setFailure(errorText(problem));
            else {
              setNotice("Privacy notice details saved.");
              reload();
            }
          }}
        >
          <Field label="Responsible party (club legal name)" value={form.responsible_party} onChange={set("responsible_party")} />
          <Field label="Physical address" value={form.physical_address} onChange={set("physical_address")} />
          <Field label="Information officer name" required value={form.info_officer_name} onChange={set("info_officer_name")} />
          <Field label="Information officer email" type="email" required value={form.info_officer_email} onChange={set("info_officer_email")} />
          <Field label="Information officer phone" type="tel" value={form.info_officer_phone} onChange={set("info_officer_phone")} />
          <Field label="Supabase hosting region" placeholder="e.g. Europe (Frankfurt) eu-central-1" value={form.hosting_region} onChange={set("hosting_region")} />
          <Field label="Retention after leaving (months)" type="number" min={1} max={120} value={form.retention_months} onChange={set("retention_months")} />
          <Button type="submit" className="h-11 self-end">Save notice details</Button>
        </form>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          Share the notice:{" "}
          <a className="text-emerald-800 underline" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/privacy/?club=${clubId}`}>
            privacy page for this club
          </a>
          . Have the club&apos;s legal adviser review the template.
        </p>
        <Notice text={notice} />
        <Notice text={failure || error} tone="error" />
      </Panel>
      <Panel title={`Data requests (${data.requests.filter((row) => row.status === "OPEN").length} open)`}>
        {data.requests.length === 0 ? <p className="text-sm font-semibold text-slate-600">No requests.</p> : null}
        <ul className="space-y-2">
          {data.requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ring-1 ring-slate-200">
              <span className="text-sm font-semibold text-slate-900">
                {request.created_at.slice(0, 10)} · {request.kind} · {who(request.player_id)} · {request.status}
                {request.details ? ` · “${request.details}”` : ""}
              </span>
              {request.status === "OPEN" ? (
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11"
                    onClick={async () => {
                      const { error: problem } = await cloud.from("data_requests").update({ status: "DONE", resolved_at: new Date().toISOString() }).eq("id", request.id);
                      if (problem) setFailure(errorText(problem));
                      else reload();
                    }}
                  >
                    Mark done
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-medium text-slate-600">
          For a deletion request, delete the player on the Players screen (this removes guardians, ratings, finance, and
          consents), then mark the request done. Keep financial records the law requires.
        </p>
      </Panel>
    </>
  );
}
