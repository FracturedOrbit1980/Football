import { CLUB_NAME } from "@/lib/club/catalog";
import { isClubTheme, type ClubThemeId } from "@/lib/club/themes";

// The "bnfc" id and these storage keys are already written into members' browsers, so they stay
// even though the club brand is now Clubstride. Only display strings change.
export const DEFAULT_CLUB_ID = "bnfc";
const REGISTRY_KEY = "bnfc-clubs";
const LEGACY_DATA_KEY = "bnfc-club-v3";

export type ClubPaymentMethod = "bank" | "portal";

export interface ClubBanking {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
}

export interface ClubPaymentPortal {
  provider: string;
  reference: string;
  link: string;
}

export interface ClubProfile {
  id: string;
  name: string;
  logo: string;
  theme: ClubThemeId;
  kind: "bnfc" | "custom";
  paymentMethod: ClubPaymentMethod;
  banking: ClubBanking;
  portal: ClubPaymentPortal;
}

export interface ClubInput {
  name: string;
  logo: string;
  theme: ClubThemeId;
  paymentMethod: ClubPaymentMethod;
  banking: ClubBanking;
  portal: ClubPaymentPortal;
}

export interface ClubRegistry {
  clubs: ClubProfile[];
  activeId: string | null;
}

export function clubDataKey(id: string) {
  return `bnfc-club-${id}`;
}

function emptyPaymentDetails() {
  return {
    paymentMethod: "bank" as ClubPaymentMethod,
    banking: { bankName: "", accountHolder: "", accountNumber: "", branchCode: "" },
    portal: { provider: "", reference: "", link: "" },
  };
}

function defaultClubProfile(): ClubProfile {
  return { id: DEFAULT_CLUB_ID, name: CLUB_NAME, logo: "", theme: "red", kind: "bnfc", ...emptyPaymentDetails() };
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

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function normalizePaymentDetails(input: Partial<ClubInput> | Partial<ClubProfile>) {
  const method: ClubPaymentMethod = input.paymentMethod === "portal" ? "portal" : "bank";
  return {
    paymentMethod: method,
    banking: {
      bankName: text(input.banking?.bankName, 60),
      accountHolder: text(input.banking?.accountHolder, 80),
      accountNumber: text(input.banking?.accountNumber, 40),
      branchCode: text(input.banking?.branchCode, 20),
    },
    portal: {
      provider: text(input.portal?.provider, 60),
      reference: text(input.portal?.reference, 60),
      link: text(input.portal?.link, 200),
    },
  };
}

export function hasPaymentDetails(club: ClubProfile) {
  if (club.paymentMethod === "portal") {
    return Boolean(club.portal.provider || club.portal.reference || club.portal.link);
  }
  return Boolean(club.banking.bankName || club.banking.accountHolder || club.banking.accountNumber || club.banking.branchCode);
}

export function paymentDetailsLines(club: ClubProfile): string[] {
  if (club.paymentMethod === "portal") {
    const lines = [
      "Pay online through the club payment portal",
      club.portal.provider ? `Provider: ${club.portal.provider}` : "",
      club.portal.reference ? `Club reference: ${club.portal.reference}` : "",
      club.portal.link ? `Portal: ${club.portal.link}` : "",
    ];
    return lines.filter(Boolean);
  }
  const lines = [
    "Pay by bank transfer",
    club.banking.bankName ? `Bank: ${club.banking.bankName}` : "",
    club.banking.accountHolder ? `Account holder: ${club.banking.accountHolder}` : "",
    club.banking.accountNumber ? `Account number: ${club.banking.accountNumber}` : "",
    club.banking.branchCode ? `Branch code: ${club.banking.branchCode}` : "",
  ];
  return lines.filter(Boolean);
}

export function paymentSummary(club: ClubProfile) {
  if (!hasPaymentDetails(club)) return "Payment details not added";
  if (club.paymentMethod === "portal") {
    return club.portal.provider ? `Payment portal · ${club.portal.provider}` : "Payment portal";
  }
  return club.banking.bankName ? `Bank transfer · ${club.banking.bankName}` : "Bank transfer";
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
    ...normalizePaymentDetails(value),
  };
}
