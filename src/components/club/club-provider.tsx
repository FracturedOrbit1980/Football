"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isCloudMode } from "@/lib/cloud/client";
import { createEmptyClub } from "@/lib/club/seed";
import { BNFC_CLUB_ID } from "@/lib/club/registry";
import { loadClubData, useClubStore } from "@/stores/club-store";
import { useClubLibrary } from "@/stores/club-library";

/** Routes backed by Supabase. They never read the on-device club store. */
export function isCloudRoute(pathname: string) {
  return /^\/(login|club|me|platform)(\/|$)/.test(pathname);
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isCloudRoute(pathname)) return children;
  return <LocalClubProvider pathname={pathname}>{children}</LocalClubProvider>;
}

function LocalClubProvider({ children, pathname }: { children: ReactNode; pathname: string }) {
  const hydrated = useClubStore((state) => state.hydrated);
  const ready = useClubLibrary((state) => state.ready);
  const activeId = useClubLibrary((state) => state.activeId);
  const refresh = useClubLibrary((state) => state.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    if (!activeId && isCloudMode()) {
      // Coach tools (drills, editor, live match) still keep their working data on this device.
      void useClubLibrary.getState().load(BNFC_CLUB_ID);
      return;
    }
    if (!activeId) {
      useClubStore.persist.setOptions({ name: "bnfc-club-pending" });
      useClubStore.setState({ hydrated: true, ...createEmptyClub() });
      return;
    }
    const club = useClubLibrary.getState().clubs.find((item) => item.id === activeId);
    if (!club) return;
    void loadClubData(activeId, club.kind);
  }, [ready, activeId]);

  if (!ready || !hydrated) {
    return <p className="text-base font-semibold text-slate-800">Loading the club…</p>;
  }

  if (!activeId && pathname !== "/") {
    return (
      <p className="text-base font-semibold text-slate-800">
        Load a club on the home screen.{" "}
        <Link href="/" className="text-emerald-700 underline">
          Choose a club
        </Link>
      </p>
    );
  }

  return children;
}
