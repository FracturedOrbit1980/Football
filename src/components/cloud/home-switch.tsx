"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";

/** Cloud mode sends people to sign in or to their club; demo mode shows the local club picker. */
export function HomeSwitch({ children }: { children: ReactNode }) {
  const cloud = useCloudSession();
  const router = useRouter();
  useEffect(() => {
    if (!cloud.enabled || cloud.loading) return;
    router.replace(cloud.session ? "/club" : "/login");
  }, [cloud.enabled, cloud.loading, cloud.session, router]);
  if (cloud.enabled) return <p className="font-semibold text-slate-800">Opening…</p>;
  return children;
}
