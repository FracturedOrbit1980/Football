"use client";

import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import type { ClubRole } from "@/lib/cloud/types";

export const inputClass =
  "mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950";

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      {props.required ? <span className="text-red-700"> *</span> : null}
      <input {...props} className={inputClass} />
      {hint ? <span className="mt-1 block text-xs font-medium text-slate-600">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <select {...props} className={inputClass}>
        {children}
      </select>
    </label>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl bg-white p-4 ring-1 ring-slate-300">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  if (!text) return null;
  return (
    <p role="status" className={`mt-2 text-sm font-semibold ${tone === "error" ? "text-red-800" : "text-emerald-800"}`}>
      {text}
    </p>
  );
}

/**
 * Client-side gate for screen UX only. The database enforces access with row level
 * security, so a bypassed gate still returns no rows from another club or player.
 */
export function CloudGate({ roles, platform, children }: { roles?: ClubRole[]; platform?: boolean; children: ReactNode }) {
  const cloud = useCloudSession();
  if (!cloud.enabled) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-base font-semibold text-amber-900 ring-1 ring-amber-300">
        This screen needs the club database. The app is running in local demo mode because Supabase is not configured.
        See the README for setup.
      </p>
    );
  }
  if (cloud.loading) return <p className="font-semibold text-slate-800">Loading your clubs…</p>;
  if (!cloud.session) {
    return (
      <p className="font-semibold text-slate-800">
        Please{" "}
        <Link href="/login" className="text-emerald-700 underline">
          sign in
        </Link>
        .
      </p>
    );
  }
  if (platform && !cloud.isPlatformAdmin) return <p className="font-semibold text-slate-800">Platform admins only.</p>;
  if (roles && !cloud.hasRole(...roles)) {
    return <p className="font-semibold text-slate-800">Your role in this club does not include this screen.</p>;
  }
  if (!platform && !cloud.activeClubId) {
    return <p className="font-semibold text-slate-800">You are not a member of a club yet. Ask your club admin for an invitation.</p>;
  }
  return children;
}

export function DemoBanner() {
  const cloud = useCloudSession();
  if (cloud.enabled) return null;
  return (
    <p className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950 ring-1 ring-amber-300" data-demo-banner>
      Local demo mode: anyone can pick any role and data stays in this browser. Do not enter real player or guardian details.
    </p>
  );
}
