"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getCloud, isCloudMode } from "@/lib/cloud/client";
import type { Club, ClubRole, Membership } from "@/lib/cloud/types";

const ACTIVE_CLUB_KEY = "football-active-club";

interface CloudSessionValue {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  email: string;
  userId: string;
  memberships: Membership[];
  clubs: Club[];
  isPlatformAdmin: boolean;
  activeClubId: string | null;
  activeClub: Club | null;
  /** Roles held in the active club. UI hint only; RLS enforces access. */
  roles: ClubRole[];
  hasRole: (...roles: ClubRole[]) => boolean;
  setActiveClub: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CloudSessionContext = createContext<CloudSessionValue | null>(null);

export function CloudSessionProvider({ children }: { children: ReactNode }) {
  const enabled = isCloudMode();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isPlatformAdmin, setPlatformAdmin] = useState(false);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  const load = useCallback(async (current: Session | null) => {
    const cloud = getCloud();
    if (!cloud || !current) {
      setMemberships([]);
      setPlatformAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    await cloud.rpc("claim_my_invites");
    const [members, platform] = await Promise.all([
      cloud
        .from("club_members")
        .select("club_id, role, clubs(id, name, player_code_prefix)")
        .eq("user_id", current.user.id),
      cloud.from("platform_admins").select("user_id").eq("user_id", current.user.id),
    ]);
    const rows = ((members.data ?? []) as unknown as Membership[]).filter((row) => row.clubs);
    setMemberships(rows);
    setPlatformAdmin((platform.data ?? []).length > 0);
    const stored = localStorage.getItem(ACTIVE_CLUB_KEY);
    const ids = Array.from(new Set(rows.map((row) => row.club_id)));
    setActiveClubId(stored && ids.includes(stored) ? stored : (ids[0] ?? null));
    setLoading(false);
  }, []);

  useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    let active = true;
    cloud.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void load(data.session);
    });
    const { data } = cloud.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<CloudSessionValue>(() => {
    const clubs = Array.from(
      new Map(memberships.flatMap((row) => (row.clubs ? [[row.club_id, row.clubs] as const] : []))).values(),
    );
    const roles = memberships.filter((row) => row.club_id === activeClubId).map((row) => row.role);
    return {
      enabled,
      loading,
      session,
      email: session?.user.email ?? "",
      userId: session?.user.id ?? "",
      memberships,
      clubs,
      isPlatformAdmin,
      activeClubId,
      activeClub: clubs.find((club) => club.id === activeClubId) ?? null,
      roles,
      hasRole: (...wanted) => wanted.some((role) => roles.includes(role)),
      setActiveClub: (id) => {
        localStorage.setItem(ACTIVE_CLUB_KEY, id);
        setActiveClubId(id);
      },
      refresh: () => load(session),
      signOut: async () => {
        localStorage.removeItem(ACTIVE_CLUB_KEY);
        await getCloud()?.auth.signOut();
      },
    };
  }, [activeClubId, enabled, isPlatformAdmin, load, loading, memberships, session]);

  return <CloudSessionContext.Provider value={value}>{children}</CloudSessionContext.Provider>;
}

export function useCloudSession() {
  const value = useContext(CloudSessionContext);
  if (!value) throw new Error("useCloudSession must be used inside CloudSessionProvider");
  return value;
}
