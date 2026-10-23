"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useRole } from "@/components/auth/role-session";
import { createEmptyClub } from "@/lib/club/seed";
import { loadClubData, useClubStore } from "@/stores/club-store";
import { useClubLibrary } from "@/stores/club-library";

export function ClubProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { clubScope } = useRole();
  const hydrated = useClubStore((state) => state.hydrated);
  const ready = useClubLibrary((state) => state.ready);
  const activeId = useClubLibrary((state) => state.activeId);
  const clubs = useClubLibrary((state) => state.clubs);
  const refresh = useClubLibrary((state) => state.refresh);
  const scopedClub = clubScope ? clubs.find((club) => club.id === clubScope) ?? null : null;

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    if (clubScope) {
      const scoped = useClubLibrary.getState().clubs.find((club) => club.id === clubScope);
      if (!scoped) return;
      if (useClubLibrary.getState().activeId !== clubScope) {
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
    if (!club) return;
    void loadClubData(activeId, club.kind);
  }, [ready, activeId, clubScope]);

  if (!ready || !hydrated) {
    return <p className="text-base font-semibold text-slate-800">Loading the club…</p>;
  }

  if (clubScope && !scopedClub) {
    return (
      <p className="text-base font-semibold text-slate-800">
        Your club is no longer registered. Sign out, then open or register a club again.
      </p>
    );
  }

  if (clubScope && activeId !== clubScope) {
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
