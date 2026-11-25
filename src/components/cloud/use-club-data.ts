"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { errorText, getCloud } from "@/lib/cloud/client";

/** Loads data for the active club. Every query runs under the user's RLS policies. */
export function useClubData<T>(loader: (cloud: SupabaseClient, clubId: string) => Promise<T>, initial: T) {
  const { activeClubId, session } = useCloudSession();
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const cloud = getCloud();
    if (!cloud || !activeClubId || !session) return;
    let live = true;
    loader(cloud, activeClubId)
      .then((next) => {
        if (!live) return;
        setData(next);
        setError("");
      })
      .catch((failure: unknown) => {
        if (live) setError(errorText(failure));
      });
    return () => {
      live = false;
    };
    // The loader is defined inline by callers; reload on club, session, or explicit refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, session, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, reload, clubId: activeClubId };
}

/** Throws the Supabase error so callers can show it. */
export function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return (result.data ?? []) as T;
}
