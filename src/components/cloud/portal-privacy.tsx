"use client";

import Link from "next/link";
import { useState } from "react";

import { Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { downloadText } from "@/lib/cloud/statements";
import { playerName, type Player } from "@/lib/cloud/types";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

type Consent = { id: string; player_id: string | null; kind: string; policy_version: string; given_at: string };
type DataRequest = { id: string; player_id: string; kind: string; status: string; created_at: string; details: string | null };

const TABLES = ["players", "guardians", "player_ratings", "budget_lines", "kit_allocations", "subs_charges", "consents", "data_requests"] as const;

/** POPIA self-service for players and guardians: notice, export, and requests. */
export function PortalPrivacy({ players }: { players: Player[] }) {
  const { data, error, reload, clubId } = useClubData(
    async (cloud, club) => {
      const [consents, requests] = await Promise.all([
        cloud.from("consents").select("*").eq("club_id", club).order("given_at", { ascending: false }),
        cloud.from("data_requests").select("*").eq("club_id", club).order("created_at", { ascending: false }),
      ]);
      return { consents: must<Consent[]>(consents), requests: must<DataRequest[]>(requests) };
    },
    { consents: [] as Consent[], requests: [] as DataRequest[] },
  );
  const [playerId, setPlayerId] = useState("");
  const [kind, setKind] = useState("ACCESS");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const cloud = getCloud()!;
  const chosen = playerId || players[0]?.id || "";
  const acknowledged = data.consents.some((row) => row.player_id === chosen && row.policy_version === PRIVACY_POLICY_VERSION);

  async function exportData() {
    setFailure("");
    try {
      // Every query runs under RLS, so the export holds only what this account may see.
      const entries = await Promise.all(
        TABLES.map(async (table) => [table, must<unknown[]>(await cloud.from(table).select("*").eq("club_id", clubId))] as const),
      );
      const file = { exported_at: new Date().toISOString(), notice_version: PRIVACY_POLICY_VERSION, ...Object.fromEntries(entries) };
      downloadText(`my-club-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 2), "application/json");
      setNotice("Your data was downloaded.");
    } catch (problem) {
      setFailure(errorText(problem));
    }
  }

  if (players.length === 0) return null;

  return (
    <Panel title="Privacy and your data">
      {players.length > 1 ? (
        <Select label="Player" value={chosen} onChange={(event) => setPlayerId(event.target.value)}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>{playerName(player)}</option>
          ))}
        </Select>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-slate-800">
        Read the{" "}
        <Link href="/privacy" className="text-emerald-800 underline">
          privacy and POPIA notice
        </Link>{" "}
        (version {PRIVACY_POLICY_VERSION}). {acknowledged ? "You have acknowledged this version." : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!acknowledged ? (
          <Button
            type="button"
            className="h-11"
            onClick={async () => {
              const { error: problem } = await cloud
                .from("consents")
                .insert({ club_id: clubId, player_id: chosen, kind: "PORTAL_NOTICE", policy_version: PRIVACY_POLICY_VERSION });
              if (problem) setFailure(errorText(problem));
              else {
                setNotice("Thank you. Your acknowledgement was recorded.");
                reload();
              }
            }}
          >
            I have read this notice
          </Button>
        ) : null}
        <Button type="button" variant="secondary" className="h-11" onClick={exportData}>
          Download my data (JSON)
        </Button>
      </div>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const { error: problem } = await cloud
            .from("data_requests")
            .insert({ club_id: clubId, player_id: chosen, kind, details: details.trim() || null });
          if (problem) setFailure(errorText(problem));
          else {
            setNotice("Request sent to the club's information officer.");
            setDetails("");
            reload();
          }
        }}
      >
        <Select label="Request" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="ACCESS">Access: send me a copy of my information</option>
          <option value="CORRECTION">Correction: fix something wrong</option>
          <option value="DELETION">Deletion: delete my information</option>
        </Select>
        <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
          Details
          <input value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base" />
        </label>
        <Button type="submit" variant="secondary" className="h-11 sm:col-span-3">Send request</Button>
      </form>
      {data.requests.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-800">
          {data.requests.map((request) => (
            <li key={request.id}>{request.created_at.slice(0, 10)} · {request.kind} · {request.status}</li>
          ))}
        </ul>
      ) : null}
      <Notice text={notice} />
      <Notice text={failure || error} tone="error" />
    </Panel>
  );
}
