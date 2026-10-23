"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { ROLE_HOME, isUserRole, usesClubScope, type UserRole } from "@/lib/auth/roles";
import { readRegistry } from "@/lib/club/registry";

const STORAGE_KEY = "bnfc-role";
const SCOPE_KEY = "bnfc-role-club";

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

function readScope(): string | null {
  return localStorage.getItem(SCOPE_KEY);
}

interface RoleContextValue {
  role: UserRole | null;
  clubScope: string | null;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const role = useSyncExternalStore(subscribe, readRole, () => null);
  const storedScope = useSyncExternalStore(subscribe, readScope, () => null);
  const clubScope = role && usesClubScope(role) ? storedScope : null;

  useEffect(() => {
    if (!role || !usesClubScope(role) || storedScope) return;
    const activeId = readRegistry().activeId;
    if (!activeId) return;
    localStorage.setItem(SCOPE_KEY, activeId);
    emit();
  }, [role, storedScope]);

  function signIn(next: UserRole) {
    if (usesClubScope(next)) {
      const activeId = readRegistry().activeId;
      if (!activeId) {
        router.push("/");
        return;
      }
      localStorage.setItem(SCOPE_KEY, activeId);
    } else {
      localStorage.removeItem(SCOPE_KEY);
    }
    localStorage.setItem(STORAGE_KEY, next);
    emit();
    router.push(ROLE_HOME[next]);
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCOPE_KEY);
    emit();
    router.push("/");
  }

  return (
    <RoleContext.Provider value={{ role, clubScope, signIn, signOut }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) {
    throw new Error("useRole must be used inside RoleProvider");
  }
  return value;
}

export function RoleGate({ allow, children }: { allow: UserRole[]; children: ReactNode }) {
  const { role } = useRole();
  const router = useRouter();
  const allowedKey = allow.join(",");

  useEffect(() => {
    const current = readRole();
    if (!current || !allowedKey.split(",").includes(current)) router.replace("/");
  }, [allowedKey, router]);

  if (!role || !allow.includes(role)) {
    return <p className="font-semibold text-slate-800">Opening your area…</p>;
  }

  return children;
}
