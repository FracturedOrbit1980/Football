"use client";

import { useEffect, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { loadTeamScope } from "@/lib/sync/team-scope";
import { queueEverything, readSettings, syncNow, useSyncState, watchClubStore } from "@/lib/sync/engine";
import { useClubStore } from "@/stores/club-store";

/** Runs background sync for staff in club mode. Demo mode never syncs. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const cloud = useCloudSession();
  const staff = cloud.hasRole("CLUB_ADMIN", "COACH", "TEAM_MANAGER", "FITNESS");
  const clubId = cloud.enabled && cloud.session && staff ? cloud.activeClubId : null;
  const hydrated = useClubStore((state) => state.hydrated);
  const userId = cloud.session?.user.id ?? null;
  const isAdmin = cloud.hasRole("CLUB_ADMIN");

  useEffect(() => {
    useSyncState.setState({ settings: readSettings(), clubId, status: clubId ? "idle" : "local" });
  }, [clubId]);

  useEffect(() => {
    if (!clubId || !hydrated || !userId) return;
    const stop = watchClubStore(clubId);
    void loadTeamScope(clubId, userId, isAdmin)
      .then(() => queueEverything(clubId))
      .then(() => syncNow());
    const kick = () => {
      if (navigator.onLine) void loadTeamScope(clubId, userId, isAdmin);
      void syncNow();
    };
    window.addEventListener("online", kick);
    window.addEventListener("offline", kick);
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener?.("change", kick);
    const timer = setInterval(kick, 120_000);
    return () => {
      stop();
      window.removeEventListener("online", kick);
      window.removeEventListener("offline", kick);
      connection?.removeEventListener?.("change", kick);
      clearInterval(timer);
    };
  }, [clubId, hydrated, userId, isAdmin]);

  return children;
}
