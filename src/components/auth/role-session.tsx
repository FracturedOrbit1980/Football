"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { ROLE_HOME, isUserRole, usesClubScope, type UserRole } from "@/lib/auth/roles";
import type { ClubRole } from "@/lib/cloud/types";
import { readRegistry } from "@/lib/club/registry";

const STORAGE_KEY = "bnfc-role";
const SCOPE_KEY = "bnfc-role-club";
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readRole(): UserRole | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isUserRole(stored) ? stored : null;
}
function readScope(): string | null { return localStorage.getItem(SCOPE_KEY); }

interface RoleContextValue {
  role: UserRole | null;
  /** Local demo sign-ins retain the club that was open when the role was chosen. */
  clubScope: string | null;
  /** Cloud areas come only from the authenticated active-club memberships. */
  areas: UserRole[];
  cloud: boolean;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}
const RoleContext = createContext<RoleContextValue | null>(null);
const AREA_FOR: Record<ClubRole, UserRole> = {
  CLUB_ADMIN: "SUPER_ADMIN", COACH: "HEAD_COACH", TEAM_MANAGER: "HEAD_COACH",
  FITNESS: "HEAD_COACH", PLAYER: "PLAYER", GUARDIAN: "PLAYER",
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const demoRole = useSyncExternalStore(subscribe, readRole, () => null);
  const storedScope = useSyncExternalStore(subscribe, readScope, () => null);
  const session = useCloudSession();
  const clubScope = !session.enabled && demoRole && usesClubScope(demoRole) ? storedScope : null;

  useEffect(() => {
    if (session.enabled || !demoRole || !usesClubScope(demoRole) || storedScope) return;
    const activeId = readRegistry().activeId;
    if (!activeId) return;
    localStorage.setItem(SCOPE_KEY, activeId);
    emit();
  }, [demoRole, session.enabled, storedScope]);

  function signIn(next: UserRole) {
    if (session.enabled) return;
    if (usesClubScope(next)) {
      const activeId = readRegistry().activeId;
      if (!activeId) { router.push("/"); return; }
      localStorage.setItem(SCOPE_KEY, activeId);
    } else localStorage.removeItem(SCOPE_KEY);
    localStorage.setItem(STORAGE_KEY, next);
    emit();
    router.push(ROLE_HOME[next]);
  }

  function signOut() {
    if (session.enabled) {
      void session.signOut().then(() => { emit(); router.push("/login"); });
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCOPE_KEY);
    emit();
    router.push("/");
  }

  const areas: UserRole[] = session.enabled
    ? session.session && !session.loading
      ? (["SUPER_ADMIN", "HEAD_COACH", "PLAYER"] as const).filter((area) => session.roles.some((role) => AREA_FOR[role] === area))
      : []
    : demoRole ? [demoRole] : [];
  return <RoleContext.Provider value={{ role: areas[0] ?? null, clubScope, areas, cloud: session.enabled, signIn, signOut }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRole must be used inside RoleProvider");
  return value;
}

/** Cloud gates guide navigation; Supabase RLS remains the real data boundary. */
export function RoleGate({ allow, children }: { allow: UserRole | UserRole[]; children: ReactNode }) {
  const { areas, cloud } = useRole();
  const session = useCloudSession();
  const router = useRouter();
  const allowedKey = (typeof allow === "string" ? [allow] : allow).join(",");
  const allowed = areas.some((area) => allowedKey.split(",").includes(area));
  const settled = !cloud || !session.loading;
  useEffect(() => {
    if (!settled || allowed) return;
    if (cloud) {
      router.replace(session.session ? (allowedKey === "PLAYER" ? "/me" : "/club") : "/login");
      return;
    }
    const current = readRole();
    if (!current || !allowedKey.split(",").includes(current)) router.replace("/");
  }, [allowed, allowedKey, cloud, router, session.session, settled]);
  if (!settled || !allowed) return <p className="font-semibold text-slate-800">Opening your area…</p>;
  return children;
}
