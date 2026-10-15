"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-session";
import { isCloudMode } from "@/lib/cloud/client";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const cloud = isCloudMode();
  useEffect(() => {
    // The local demo page lists every player on this device; signed-in players use their own portal.
    if (cloud) router.replace("/me");
  }, [cloud, router]);
  if (cloud) return <p className="font-semibold text-slate-800">Opening your portal…</p>;
  return <RoleGate allow="PLAYER">{children}</RoleGate>;
}
