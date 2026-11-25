"use client";

import Link from "next/link";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { ClubPrivacyAdmin } from "@/components/cloud/club-privacy-admin";
import { CloudGate, Panel, Select } from "@/components/cloud/cloud-ui";
import { SyncSettings } from "@/components/sync/sync-settings";
import { CLUB_ROLE_LABEL, type ClubRole } from "@/lib/cloud/types";

const LINKS: { href: string; label: string; roles: ClubRole[] }[] = [
  { href: "/club/teams", label: "Teams and staff", roles: ["CLUB_ADMIN"] },
  { href: "/club/players", label: "Players and registration", roles: ["CLUB_ADMIN", "TEAM_MANAGER", "COACH", "FITNESS"] },
  { href: "/club/ratings", label: "Player ratings", roles: ["CLUB_ADMIN", "COACH"] },
  { href: "/club/finance", label: "Finance and statements", roles: ["CLUB_ADMIN", "TEAM_MANAGER"] },
  { href: "/club/sponsors", label: "Sponsors and branding", roles: ["CLUB_ADMIN"] },
  { href: "/coach", label: "Drills, editor, and live match (this device)", roles: ["COACH", "TEAM_MANAGER", "FITNESS"] },
  { href: "/me", label: "My player portal", roles: ["PLAYER", "GUARDIAN"] },
];

export function ClubHome() {
  const cloud = useCloudSession();
  return (
    <>
      {cloud.isPlatformAdmin ? (
        <Panel title="Platform">
          <Link href="/platform" className="font-bold text-emerald-800 underline">
            Create clubs
          </Link>
        </Panel>
      ) : null}
      <CloudGate>
        <Panel title="Your club">
          {cloud.clubs.length > 1 ? (
            <Select label="Club" value={cloud.activeClubId ?? ""} onChange={(event) => cloud.setActiveClub(event.target.value)}>
              {cloud.clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-lg font-bold text-slate-950">{cloud.activeClub?.name}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Signed in as {cloud.email}. Roles: {cloud.roles.map((role) => CLUB_ROLE_LABEL[role]).join(", ") || "none"}.
          </p>
        </Panel>
        <div className="flex flex-wrap gap-3">
          {LINKS.filter((link) => cloud.hasRole(...link.roles)).map((link) => (
            <Link key={link.href} href={link.href} className="btn-quiet min-h-11 rounded-lg px-4 py-3 text-base font-bold">
              {link.label}
            </Link>
          ))}
        </div>
        {cloud.hasRole("CLUB_ADMIN", "COACH", "TEAM_MANAGER", "FITNESS") ? (
          <div className="mt-6">
            <SyncSettings />
          </div>
        ) : null}
        {cloud.hasRole("CLUB_ADMIN") ? (
          <div className="mt-6">
            <ClubPrivacyAdmin />
          </div>
        ) : null}
      </CloudGate>
    </>
  );
}
