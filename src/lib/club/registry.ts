import { CLUB_NAME } from "@/lib/club/catalog";
import { isClubTheme, type ClubThemeId } from "@/lib/club/themes";

// The "bnfc" id and these storage keys are already written into members' browsers, so they stay
// even though the club brand is now Clubstride. Only display strings change.
export const DEFAULT_CLUB_ID = "bnfc";
const REGISTRY_KEY = "bnfc-clubs";
const LEGACY_DATA_KEY = "bnfc-club-v3";

export interface ClubProfile {
  id: string;
  name: string;
  logo: string;
  theme: ClubThemeId;
  kind: "bnfc" | "custom";
}

export interface ClubRegistry {
  clubs: ClubProfile[];
  activeId: string | null;
}

export function clubDataKey(id: string) {
  return `bnfc-club-${id}`;
}

function defaultClubProfile(): ClubProfile {
  return { id: DEFAULT_CLUB_ID, name: CLUB_NAME, logo: "", theme: "red", kind: "bnfc" };
}

export function readRegistry(): ClubRegistry {
  if (typeof window === "undefined") return { clubs: [defaultClubProfile()], activeId: null };
  const raw = localStorage.getItem(REGISTRY_KEY);
  if (!raw) {
    const registry: ClubRegistry = { clubs: [defaultClubProfile()], activeId: null };
    const legacy = localStorage.getItem(LEGACY_DATA_KEY);
    if (legacy && !localStorage.getItem(clubDataKey(DEFAULT_CLUB_ID))) {
      localStorage.setItem(clubDataKey(DEFAULT_CLUB_ID), legacy);
    }
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    return registry;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ClubRegistry>;
    const clubs = Array.isArray(parsed.clubs) ? parsed.clubs.map(normalizeProfile).filter((club) => club.name) : [];
    if (!clubs.some((club) => club.id === DEFAULT_CLUB_ID)) clubs.unshift(defaultClubProfile());
    const activeId = clubs.some((club) => club.id === parsed.activeId) ? parsed.activeId ?? null : null;
    const registry = { clubs, activeId };
    const stored = JSON.stringify(parsed.clubs ?? []);
    const next = JSON.stringify(clubs);
    if (stored !== next) writeRegistry(registry);
    return registry;
  } catch {
    return { clubs: [defaultClubProfile()], activeId: null };
  }
}

export function writeRegistry(registry: ClubRegistry) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

function normalizeProfile(value: Partial<ClubProfile>): ClubProfile {
  const theme = value.theme && isClubTheme(value.theme) ? value.theme : "red";
  const id = value.id || `club-${Date.now()}`;
  const isDefaultClub = id === DEFAULT_CLUB_ID || value.kind === "bnfc";
  return {
    id: isDefaultClub ? DEFAULT_CLUB_ID : id,
    name: isDefaultClub ? CLUB_NAME : (value.name ?? "").trim(),
    logo: isDefaultClub ? "" : (value.logo ?? ""),
    theme,
    kind: isDefaultClub ? "bnfc" : "custom",
  };
}
