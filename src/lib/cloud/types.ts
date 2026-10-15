export const CLUB_ROLES = ["CLUB_ADMIN", "COACH", "TEAM_MANAGER", "FITNESS", "PLAYER", "GUARDIAN"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];
export const STAFF_ROLES = ["COACH", "TEAM_MANAGER", "FITNESS"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const SPONSOR_PLACEMENTS = ["HEADER", "APP_BACKGROUND", "PITCH_WATERMARK", "STATEMENT", "KIT"] as const;
export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number];

export const CLUB_ROLE_LABEL: Record<ClubRole, string> = {
  CLUB_ADMIN: "Club admin",
  COACH: "Coach",
  TEAM_MANAGER: "Team manager",
  FITNESS: "Fitness / conditioning",
  PLAYER: "Player",
  GUARDIAN: "Parent / guardian",
};

export const PLACEMENT_LABEL: Record<SponsorPlacement, string> = {
  HEADER: "App header",
  APP_BACKGROUND: "App background",
  PITCH_WATERMARK: "Pitch and tactics boards",
  STATEMENT: "Statements",
  KIT: "Kit",
};

export interface Club {
  id: string;
  name: string;
  player_code_prefix: string;
}

export interface Membership {
  club_id: string;
  role: ClubRole;
  clubs: Club | null;
}

export interface Team {
  id: string;
  club_id: string;
  age_group_id: string;
  name: string;
}

export interface AgeGroup {
  id: string;
  club_id: string;
  name: string;
  display_order: number;
}

export interface TeamStaff {
  team_id: string;
  club_id: string;
  user_id: string;
  role: StaffRole;
}

export interface Member {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  display_name: string | null;
}

export interface Player {
  id: string;
  club_id: string;
  team_id: string | null;
  user_id: string | null;
  player_code: string;
  card_ref: string | null;
  card_issued_on: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  position: string | null;
  squad_number: number | null;
  active: boolean;
}

export interface Guardian {
  id: string;
  club_id: string;
  player_id: string;
  user_id: string | null;
  full_name: string;
  relationship: string | null;
  email: string;
  phone: string;
  alt_phone: string | null;
  consent_at: string | null;
}

export interface Rating {
  id: string;
  club_id: string;
  player_id: string;
  rated_by: string | null;
  rated_on: string;
  technical: number;
  tactical: number;
  physical: number;
  mental: number;
  notes: string | null;
}

export interface BudgetLine {
  id: string;
  club_id: string;
  player_id: string;
  description: string;
  amount_cents: number;
  due_on: string | null;
}

export interface KitItem {
  id: string;
  club_id: string;
  name: string;
  size: string;
  unit_value_cents: number;
}

export interface KitAllocation {
  id: string;
  club_id: string;
  player_id: string;
  kit_item_id: string;
  quantity: number;
  unit_value_cents: number;
  issued_on: string;
  returned_on: string | null;
}

export interface SubsCharge {
  id: string;
  club_id: string;
  player_id: string;
  period: string;
  amount_cents: number;
  paid: boolean;
  paid_on: string | null;
  method: string | null;
}

export interface Sponsor {
  id: string;
  club_id: string;
  name: string;
  website: string | null;
  logo_path: string | null;
  placement: SponsorPlacement;
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  sort_order: number;
}

export interface Branding {
  club_id: string;
  logo_path: string | null;
  watermark_path: string | null;
  backdrop_path: string | null;
  watermark_opacity: number;
  primary_color: string | null;
}

export interface Invite {
  id: string;
  club_id: string;
  email: string;
  role: ClubRole;
  team_id: string | null;
  player_id: string | null;
  accepted_at: string | null;
  created_at: string;
}

export function playerName(player: Pick<Player, "first_name" | "last_name">) {
  return `${player.first_name} ${player.last_name}`.trim();
}
