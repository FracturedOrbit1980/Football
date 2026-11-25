"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useRole } from "@/components/auth/role-session";
import { useCloudSession } from "@/components/cloud/cloud-session";
import { createEmptyClub } from "@/lib/club/seed";
import { loadClubData, useClubStore } from "@/stores/club-store";
import { useClubLibrary } from "@/stores/club-library";

/** Cloud screens use their own membership gates and never mount the demo workspace. */
export function isCloudRoute(pathname: string) {
  return /^\/(login|club|me|platform|privacy)(\/|$)/.test(pathname);
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cloud = useCloudSession();
  if (isCloudRoute(pathname) || (cloud.enabled && pathname === "/")) return children;
  return <LocalClubProvider pathname={pathname}>{children}</LocalClubProvider>;
}

function LocalClubProvider({ children, pathname }: { children: ReactNode; pathname: string }) {
  const router = useRouter();
  const cloud = useCloudSession();
  const { clubScope } = useRole();
  const cloudClubId = cloud.enabled ? cloud.activeClubId : null;
  const cloudClubName = cloud.activeClub?.name ?? "";
  const cloudStaff = cloud.hasRole("CLUB_ADMIN", "COACH", "TEAM_MANAGER", "FITNESS");
  const hydrated = useClubStore((state) => state.hydrated);
  const ready = useClubLibrary((state) => state.ready);
  const activeId = useClubLibrary((state) => state.activeId);
  const clubs = useClubLibrary((state) => state.clubs);
  const refresh = useClubLibrary((state) => state.refresh);
  const scopedClub = clubScope ? clubs.find((club) => club.id === clubScope) ?? null : null;

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!cloud.enabled || cloud.loading) return;
    if (!cloud.session) router.replace("/login");
    else if (!cloudClubId || !cloudStaff) router.replace(pathname.startsWith("/player") ? "/me" : "/club");
  }, [cloud.enabled, cloud.loading, cloud.session, cloudClubId, cloudStaff, pathname, router]);

  useEffect(() => {
    if (!ready) return;
    if (cloud.enabled) {
      // Never fall back to a demo/default club while auth or memberships are absent.
      if (cloud.loading || !cloud.session || !cloudClubId || !cloudStaff) return;
      if (activeId !== `cloud-${cloudClubId}`) {
        void useClubLibrary.getState().openCloudWorkspace(cloudClubId, cloudClubName);
        return;
      }
    } else if (clubScope) {
      const scoped = useClubLibrary.getState().clubs.find((club) => club.id === clubScope);
      if (!scoped) return;
      if (activeId !== clubScope) {
        void useClubLibrary.getState().load(clubScope);
        return;
      }
      void loadClubData(clubScope, scoped.kind);
      return;
    }
    if (!activeId) {
      useClubStore.persist.setOptions({ name: "bnfc-club-pending" });
      useClubStore.setState({ hydrated: true, ...createEmptyClub() });
      return;
    }
    const club = useClubLibrary.getState().clubs.find((item) => item.id === activeId);
    if (club) void loadClubData(activeId, club.kind);
  }, [ready, activeId, clubScope, cloud.enabled, cloud.loading, cloud.session, cloudClubId, cloudClubName, cloudStaff]);

  if (cloud.enabled && (cloud.loading || !cloud.session || !cloudClubId || !cloudStaff || activeId !== `cloud-${cloudClubId}`)) {
    return <p className="font-semibold text-slate-800">Opening your club…</p>;
  }
  if (!ready || !hydrated) return <p className="text-base font-semibold text-slate-800">Loading the club…</p>;
  if (clubScope && !scopedClub) {
    return <p className="text-base font-semibold text-slate-800">Your club is no longer registered. Sign out, then open or register a club again.</p>;
  }
  if (clubScope && activeId !== clubScope) return <p className="text-base font-semibold text-slate-800">Loading the club…</p>;
  if (!activeId && pathname !== "/") {
    return <p className="text-base font-semibold text-slate-800">Load a club on the home screen.{" "}<Link href="/" className="text-emerald-700 underline">Choose a club</Link></p>;
  }
  return children;
}
