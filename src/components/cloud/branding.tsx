"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { getCloud } from "@/lib/cloud/client";
import type { Branding, Sponsor } from "@/lib/cloud/types";
import { BNFC_CLUB_ID } from "@/lib/club/registry";
import { activeClub, useClubLibrary } from "@/stores/club-library";

export const LOGO_BUCKET = "club-logos";
export const BACKDROP_BUCKET = "club-backdrops";

export interface BrandingValue {
  logoUrl: string;
  watermarkUrl: string;
  backdropUrl: string;
  watermarkOpacity: number;
  sponsors: (Sponsor & { logoUrl: string })[];
  branding: Branding | null;
  reload: () => void;
}

const BrandingContext = createContext<BrandingValue | null>(null);

async function signed(bucket: string, path: string | null) {
  if (!path) return "";
  const { data } = await getCloud()!.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

/**
 * Per-club logo, watermark, backdrop, and sponsors. In cloud mode the files sit in
 * private, club-scoped storage and are served through short-lived signed URLs.
 * In demo mode the local club's crest doubles as the watermark.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const cloud = useCloudSession();
  const local = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const localLogo = local?.logo || (local?.id === BNFC_CLUB_ID ? `${base}/icons/bnfc-logo.jpg` : "");
  const [remote, setRemote] = useState<Omit<BrandingValue, "reload"> | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    const client = getCloud();
    const clubId = cloud.activeClubId;
    if (!client || !clubId || !cloud.session) return;
    let live = true;
    (async () => {
      const [{ data: brand }, { data: sponsorRows }] = await Promise.all([
        client.from("club_branding").select("*").eq("club_id", clubId).maybeSingle(),
        client.from("sponsors").select("*").eq("club_id", clubId).eq("active", true).order("sort_order"),
      ]);
      const branding = (brand ?? null) as Branding | null;
      const [logoUrl, watermarkUrl, backdropUrl] = await Promise.all([
        signed(LOGO_BUCKET, branding?.logo_path ?? null),
        signed(BACKDROP_BUCKET, branding?.watermark_path ?? null),
        signed(BACKDROP_BUCKET, branding?.backdrop_path ?? null),
      ]);
      const sponsors = await Promise.all(
        ((sponsorRows ?? []) as Sponsor[]).map(async (sponsor) => ({ ...sponsor, logoUrl: await signed(LOGO_BUCKET, sponsor.logo_path) })),
      );
      if (live) {
        setRemote({
          branding,
          logoUrl,
          watermarkUrl,
          backdropUrl,
          watermarkOpacity: Number(branding?.watermark_opacity ?? 0.12),
          sponsors,
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [cloud.activeClubId, cloud.session, version]);

  const value = useMemo<BrandingValue>(() => {
    if (cloud.enabled) {
      const current = cloud.activeClubId && remote ? remote : null;
      const pitchSponsor = current?.sponsors.find((sponsor) => sponsor.placement === "PITCH_WATERMARK" && sponsor.logoUrl);
      const backgroundSponsor = current?.sponsors.find((sponsor) => sponsor.placement === "APP_BACKGROUND" && sponsor.logoUrl);
      return {
        branding: current?.branding ?? null,
        logoUrl: current?.logoUrl ?? "",
        watermarkUrl: current?.watermarkUrl || pitchSponsor?.logoUrl || current?.logoUrl || "",
        backdropUrl: current?.backdropUrl || backgroundSponsor?.logoUrl || "",
        watermarkOpacity: current?.watermarkOpacity ?? 0.12,
        sponsors: current?.sponsors ?? [],
        reload,
      };
    }
    return { branding: null, logoUrl: localLogo, watermarkUrl: localLogo, backdropUrl: "", watermarkOpacity: 0.1, sponsors: [], reload };
  }, [cloud.activeClubId, cloud.enabled, localLogo, reload, remote]);

  const primary = cloud.enabled ? value.branding?.primary_color ?? null : null;
  const accent = cloud.enabled ? value.branding?.accent_color ?? null : null;
  useEffect(() => applyClubColours(primary, accent), [primary, accent]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const value = useContext(BrandingContext);
  if (!value) throw new Error("useBranding must be used inside BrandingProvider");
  return value;
}

/** Club watermark laid over a pitch or tactics board. Purely decorative. */
export function PitchWatermark() {
  const { watermarkUrl, watermarkOpacity } = useBranding();
  if (!watermarkUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={watermarkUrl}
      alt=""
      aria-hidden
      data-club-watermark
      className="pointer-events-none absolute left-1/2 top-1/2 h-1/3 w-auto -translate-x-1/2 -translate-y-1/2 select-none object-contain"
      style={{ opacity: watermarkOpacity }}
    />
  );
}

/** Faint per-club backdrop behind the whole app. */
export function AppBackdrop() {
  const { backdropUrl } = useBranding();
  if (!backdropUrl) return null;
  return (
    <div
      aria-hidden
      data-club-backdrop
      className="pointer-events-none fixed inset-0 -z-0 bg-cover bg-center opacity-[0.07]"
      style={{ backgroundImage: `url("${backdropUrl.replace(/"/g, "%22")}")` }}
    />
  );
}

/** Active header sponsors. */
export function SponsorStrip() {
  const { sponsors } = useBranding();
  const shown = sponsors.filter((sponsor) => sponsor.placement === "HEADER");
  if (shown.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600" data-sponsors>
      <span>Supported by</span>
      {shown.map((sponsor) => {
        const content = sponsor.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sponsor.logoUrl} alt={sponsor.name} className="h-8 w-auto object-contain" />
        ) : (
          <span>{sponsor.name}</span>
        );
        return sponsor.website ? (
          <a key={sponsor.id} href={sponsor.website} target="_blank" rel="noopener noreferrer sponsored">
            {content}
          </a>
        ) : (
          <span key={sponsor.id}>{content}</span>
        );
      })}
    </div>
  );
}

const COLOUR_VARS = [
  "--color-emerald-50", "--color-emerald-100", "--color-emerald-200", "--color-emerald-300", "--color-emerald-400",
  "--color-emerald-500", "--color-emerald-600", "--color-emerald-700", "--color-emerald-800", "--primary", "--sidebar-primary",
];

/** Club mode: derive the theme scale from the club's own colours (Brand screen). */
function applyClubColours(primary: string | null, accent: string | null) {
  const style = document.documentElement.style;
  if (!primary) {
    for (const name of COLOUR_VARS) style.removeProperty(name);
    return;
  }
  const tint = (pct: number) => `color-mix(in srgb, ${primary} ${pct}%, white)`;
  const shade = (pct: number) => `color-mix(in srgb, ${primary} ${pct}%, black)`;
  const gold = accent ?? "#f8d058";
  const values: Record<string, string> = {
    "--color-emerald-50": tint(6),
    "--color-emerald-100": tint(18),
    "--color-emerald-200": tint(32),
    "--color-emerald-300": gold,
    "--color-emerald-400": gold,
    "--color-emerald-500": primary,
    "--color-emerald-600": shade(82),
    "--color-emerald-700": shade(66),
    "--color-emerald-800": shade(82),
    "--primary": primary,
    "--sidebar-primary": primary,
  };
  for (const [name, colour] of Object.entries(values)) style.setProperty(name, colour);
}
