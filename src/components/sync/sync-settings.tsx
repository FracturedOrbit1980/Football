"use client";

import { Panel } from "@/components/cloud/cloud-ui";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";

import { errorText, getCloud } from "@/lib/cloud/client";
import {
  connectionType,
  keepLocalOnly,
  retryAttention,
  syncNow,
  useSyncState,
  writeSettings,
  type AttentionItem,
  type SyncStatus,
} from "@/lib/sync/engine";
import { useTeamScope } from "@/lib/sync/team-scope";
import { useClubStore } from "@/stores/club-store";

const LABEL: Record<SyncStatus, string> = {
  local: "On this device only",
  off: "Sync off",
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline: changes are saved and will sync later",
  "waiting-wifi": "Waiting for Wi-Fi",
  error: "Sync problem",
};

function ago(iso: string | null) {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : new Date(iso).toLocaleString("en-ZA");
}

export function SyncIndicator() {
  const { status, pending, lastSyncedAt, attention } = useSyncState();
  if (status === "local") return null;
  if (attention.length > 0 && status !== "syncing")
    return (
      <span className="font-bold text-amber-800" data-sync-status="attention" role="status">
        {attention.length} record{attention.length === 1 ? "" : "s"} not synced: see Club home → Sync
      </span>
    );
  const tone = status === "error" ? "text-red-800" : status === "idle" ? "text-emerald-800" : "text-amber-800";
  return (
    <span className={`font-bold ${tone}`} data-sync-status={status} role="status">
      {LABEL[status]}
      {pending > 0 ? ` · ${pending} waiting` : ""}
      {status === "idle" && lastSyncedAt ? ` · ${ago(lastSyncedAt)}` : ""}
    </span>
  );
}

export function SyncSettings() {
  const { status, pending, lastSyncedAt, error, settings } = useSyncState();
  const connection = typeof navigator === "undefined" ? "unknown" : connectionType();
  return (
    <Panel title="Sync (drills and match records)">
      <p className="text-sm font-semibold text-slate-800">
        <SyncIndicator /> {lastSyncedAt ? `· last synced ${ago(lastSyncedAt)}` : ""}
      </p>
      {error ? <p className="mt-1 text-sm font-semibold text-red-800">{error}</p> : null}
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="size-5" checked={settings.enabled} onChange={(event) => writeSettings({ ...settings, enabled: event.target.checked })} />
          Sync automatically
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="size-5" checked={settings.wifiOnly} onChange={(event) => writeSettings({ ...settings, wifiOnly: event.target.checked })} />
          Only on Wi-Fi
        </label>
        {settings.wifiOnly && connection === "unknown" ? (
          <p className="text-xs font-medium text-slate-600">
            This browser does not report Wi-Fi versus mobile data (most iPhones and computers), so automatic sync waits.
            Use “Sync now” when you are on Wi-Fi.
          </p>
        ) : null}
      </div>
      <Button type="button" className="mt-3 h-11" disabled={status === "syncing" || status === "local"} onClick={() => void syncNow(true)}>
        Sync now{pending > 0 ? ` (${pending})` : ""}
      </Button>
      <AttentionList />
      <UnassignedMatches />
      <p className="mt-2 text-xs font-medium text-slate-600">
        Drills you create and saved matches are kept on this device and copied to the club when online. If the same record
        was changed on two devices, the most recent change wins.
      </p>
    </Panel>
  );
}

function TeamSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const teams = useTeamScope((state) => state.teams);
  return (
    <select className="h-10 rounded-lg border border-slate-400 bg-white px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose team…</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}

/** Records held on this device (no club team) or refused by the server. */
function AttentionList() {
  const attention = useSyncState((state) => state.attention);
  const assignMatchTeam = useClubStore((state) => state.assignMatchTeam);
  if (attention.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300" data-sync-attention>
      <p className="text-sm font-bold text-amber-900">Not synced ({attention.length})</p>
      <ul className="mt-2 space-y-3">
        {attention.map((item: AttentionItem) => (
          <li key={item.key} className="text-sm text-slate-900">
            <p className="font-semibold">
              {item.table === "club_matches" ? "Match" : "Drill"}: {item.label}
            </p>
            <p className="text-xs font-medium text-slate-700">
              {item.state === "held" ? "Waiting for a club team. " : "Refused by the club server. "}
              {item.reason}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {item.table === "club_matches" ? (
                <TeamSelect value="" onChange={(team) => team && assignMatchTeam(item.localId, team)} />
              ) : null}
              <Button type="button" variant="secondary" className="h-10" onClick={() => void retryAttention([item.key])}>
                Try again
              </Button>
              <Button type="button" variant="ghost" className="h-10" onClick={() => void keepLocalOnly(item.key)}>
                Keep on this device only
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface UnassignedRow {
  id: string;
  opponent: string;
  played_on: string | null;
  team_label: string | null;
}

/** Club admins: matches in the club that are not on any team yet. */
function UnassignedMatches() {
  const isAdmin = useTeamScope((state) => state.isAdmin);
  const clubId = useSyncState((state) => state.clubId);
  const [rows, setRows] = useState<UnassignedRow[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const cloud = getCloud();
    if (!cloud || !clubId || !isAdmin) return;
    const { data, error } = await cloud
      .from("club_matches")
      .select("id, opponent, played_on, team_label")
      .eq("club_id", clubId)
      .is("team_id", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) setMessage(errorText(error));
    else setRows((data ?? []) as UnassignedRow[]);
  }, [clubId, isAdmin]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads remote data once per club
    void load();
  }, [load]);
  if (!isAdmin || rows.length === 0) return message ? <p className="mt-2 text-sm text-red-800">{message}</p> : null;
  return (
    <div className="mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300" data-unassigned-matches>
      <p className="text-sm font-bold text-amber-900">Unassigned matches ({rows.length})</p>
      <p className="text-xs font-medium text-slate-700">Only club admins can see these until they are put on a team.</p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
            <span className="font-semibold">
              vs {row.opponent || "?"} {row.played_on ? `(${row.played_on})` : ""} {row.team_label ? `· was “${row.team_label}”` : ""}
            </span>
            <TeamSelect
              value=""
              onChange={async (team) => {
                if (!team) return;
                const { error } = await getCloud()!
                  .from("club_matches")
                  .update({ team_id: team, updated_at: new Date().toISOString() })
                  .eq("id", row.id);
                setMessage(error ? errorText(error) : "Match assigned.");
                await load();
                void syncNow(true);
              }}
            />
          </li>
        ))}
      </ul>
      {message ? <p className="mt-2 text-sm font-semibold text-slate-800">{message}</p> : null}
    </div>
  );
}
