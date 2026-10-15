"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { ROLE_HOME, isUserRole, type UserRole } from "@/lib/auth/roles";
import type { ClubRole } from "@/lib/cloud/types";

const STORAGE_KEY = "bnfc-role";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRole(): UserRole | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isUserRole(stored) ? stored : null;
}

interface RoleContextValue {
  /** Primary area for navigation. In cloud mode this is derived from club roles. */
  role: UserRole | null;
  /** Every area the user may open. Demo mode has exactly one. */
  areas: UserRole[];
  cloud: boolean;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const AREA_FOR: Record<ClubRole, UserRole> = {
  CLUB_ADMIN: "SUPER_ADMIN",
  COACH: "HEAD_COACH",
  TEAM_MANAGER: "HEAD_COACH",
  FITNESS: "HEAD_COACH",
  PLAYER: "PLAYER",
  GUARDIAN: "PLAYER",
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const demoRole = useSyncExternalStore(subscribe, readRole, () => null);
  const cloud = useCloudSession();

  function signIn(next: UserRole) {
    if (cloud.enabled) return;
    localStorage.setItem(STORAGE_KEY, next);
    emit();
    router.push(ROLE_HOME[next]);
  }

  function signOut() {
    if (cloud.enabled) {
      void cloud.signOut().then(() => router.push("/login"));
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    emit();
    router.push("/");
  }

  const areas: UserRole[] = cloud.enabled
    ? (["SUPER_ADMIN", "HEAD_COACH", "PLAYER"] as const).filter((area) => cloud.roles.some((role) => AREA_FOR[role] === area))
    : demoRole
      ? [demoRole]
      : [];
  const role = areas[0] ?? null;

  return (
    <RoleContext.Provider value={{ role, areas, cloud: cloud.enabled, signIn, signOut }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) {
    throw new Error("useRole must be used inside RoleProvider");
  }
  return value;
}

/** Screen gate for UX. In cloud mode the database's RLS is the real boundary. */
export function RoleGate({ allow, children }: { allow: UserRole; children: ReactNode }) {
  const { areas, cloud } = useRole();
  const session = useCloudSession();
  const router = useRouter();
  const allowed = areas.includes(allow);
  const settled = !cloud || !session.loading;

  useEffect(() => {
    if (!settled || allowed) return;
    if (cloud) {
      router.replace(session.session ? (allow === "PLAYER" ? "/me" : "/club") : "/login");
      return;
    }
    if (readRole() !== allow) router.replace("/");
  }, [allow, allowed, cloud, router, session.session, settled]);

  if (!allowed) {
    return <p className="font-semibold text-slate-800">Opening your area…</p>;
  }

  return children;
}
