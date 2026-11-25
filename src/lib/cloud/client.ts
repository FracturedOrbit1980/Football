"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getAuthMode, getSupabaseEnv } from "@/lib/supabase/env";

let client: SupabaseClient | null | undefined;

/** True when the app talks to Supabase. False means the local, single-device demo. */
export function isCloudMode() {
  return getAuthMode() === "supabase";
}

/**
 * Browser client. Row level security in Supabase is the security boundary:
 * every request runs as the signed-in user, and only the public anon key ships.
 */
export function getCloud(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = getSupabaseEnv();
  client =
    isCloudMode() && env && typeof window !== "undefined"
      ? createClient(env.url, env.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
        })
      : null;
  return client;
}

export function requireCloud(): SupabaseClient {
  const cloud = getCloud();
  if (!cloud) throw new Error("Supabase is not configured.");
  return cloud;
}

export function appUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}${path}`;
}

export function errorText(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "Something went wrong.";
}
