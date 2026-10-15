"use client";

import { Panel } from "@/components/cloud/cloud-ui";
import { Button } from "@/components/ui/button";
import { connectionType, syncNow, useSyncState, writeSettings, type SyncStatus } from "@/lib/sync/engine";

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
  const { status, pending, lastSyncedAt } = useSyncState();
  if (status === "local") return null;
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
      <p className="mt-2 text-xs font-medium text-slate-600">
        Drills you create and saved matches are kept on this device and copied to the club when online. If the same record
        was changed on two devices, the most recent change wins.
      </p>
    </Panel>
  );
}
