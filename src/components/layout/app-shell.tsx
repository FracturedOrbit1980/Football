"use client";

import {
  Building2,
  ClipboardList,
  Palette,
  Star,
  UserRound,
  Wallet,
  LayoutDashboard,
  Library,
  Pencil,
  Timer,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useRole } from "@/components/auth/role-session";
import { AppBackdrop, SponsorStrip, useBranding } from "@/components/cloud/branding";
import { useCloudSession } from "@/components/cloud/cloud-session";
import { DemoBanner } from "@/components/cloud/cloud-ui";
import { SyncIndicator } from "@/components/sync/sync-settings";
import type { ClubRole } from "@/lib/cloud/types";
import { AppearanceToggle } from "@/components/layout/appearance";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ROLE_HOME, ROLE_LABEL, type UserRole } from "@/lib/auth/roles";
import { activeClub, useClubLibrary } from "@/stores/club-library";

const NAV: Record<UserRole, { href: string; label: string; icon: typeof Users }[]> = {
  SUPER_ADMIN: [
    { href: "/admin", label: "Club", icon: LayoutDashboard },
    { href: "/admin/people", label: "People", icon: Users },
    { href: "/admin/drills", label: "Drills", icon: Library },
  ],
  HEAD_COACH: [
    { href: "/coach", label: "Home", icon: LayoutDashboard },
    { href: "/coach/roster", label: "Squad", icon: Users },
    { href: "/coach/drills", label: "Drills", icon: ClipboardList },
    { href: "/coach/editor", label: "Editor", icon: Pencil },
    { href: "/coach/match", label: "Match", icon: Timer },
  ],
  PLAYER: [{ href: "/player", label: "My game", icon: Users }],
};

type NavItem = { href: string; label: string; icon: typeof Users };

const CLOUD_NAV: (NavItem & { roles: ClubRole[] })[] = [
  { href: "/club", label: "Club", icon: LayoutDashboard, roles: ["CLUB_ADMIN", "COACH", "TEAM_MANAGER", "FITNESS"] },
  { href: "/club/teams", label: "Teams", icon: Building2, roles: ["CLUB_ADMIN"] },
  { href: "/club/players", label: "Players", icon: Users, roles: ["CLUB_ADMIN", "TEAM_MANAGER", "COACH", "FITNESS"] },
  { href: "/club/ratings", label: "Ratings", icon: Star, roles: ["CLUB_ADMIN", "COACH"] },
  { href: "/club/finance", label: "Finance", icon: Wallet, roles: ["CLUB_ADMIN", "TEAM_MANAGER"] },
  { href: "/club/sponsors", label: "Brand", icon: Palette, roles: ["CLUB_ADMIN"] },
  { href: "/coach/drills", label: "Drills", icon: ClipboardList, roles: ["COACH", "FITNESS"] },
  { href: "/coach/editor", label: "Editor", icon: Pencil, roles: ["COACH"] },
  { href: "/coach/match", label: "Match", icon: Timer, roles: ["COACH", "TEAM_MANAGER"] },
  { href: "/me", label: "My portal", icon: UserRound, roles: ["PLAYER", "GUARDIAN"] },
];

function cloudNav(roles: ClubRole[], platform: boolean): NavItem[] {
  const items: NavItem[] = CLOUD_NAV.filter((item) => item.roles.some((role) => roles.includes(role)));
  if (platform) items.push({ href: "/platform", label: "Platform", icon: Building2 });
  return items;
}

function stripSlash(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isActive(pathname: string, href: string) {
  const current = stripSlash(pathname);
  const target = stripSlash(href);
  if (href === ROLE_HOME.SUPER_ADMIN || href === ROLE_HOME.HEAD_COACH || href === ROLE_HOME.PLAYER || href === "/club") {
    return current === target;
  }
  return current === target || current.startsWith(`${target}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const cloud = useCloudSession();
  const brand = useBranding();
  const items = cloud.enabled ? (cloud.session ? cloudNav(cloud.roles, cloud.isPlatformAdmin) : []) : role ? NAV[role] : [];
  const localClub = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const clubName = cloud.enabled ? (cloud.activeClub?.name ?? "Football") : (localClub?.name ?? "Load a club");
  const mark = { name: clubName, logo: brand.logoUrl };
  const signedIn = cloud.enabled ? !!cloud.session : !!role;
  const roleText = cloud.enabled ? (cloud.session ? cloud.email : "") : role ? ROLE_LABEL[role] : "";

  return (
    <div className="min-h-full bg-slate-100 text-slate-950">
      <AppBackdrop />
      <header className="app-chrome fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 px-4 md:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-bold">
          <ClubMark club={mark} />
          <span className="truncate">{clubName}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <AppearanceToggle />
          {signedIn ? <SignOutButton /> : null}
        </div>
      </header>

      <aside className="app-chrome fixed inset-y-0 left-0 z-20 hidden w-64 flex-col md:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-5">
          <ClubMark club={mark} />
          <span>
            <span className="block text-sm font-bold leading-tight">{clubName}</span>
            <span className="text-xs font-medium text-emerald-300">{cloud.enabled ? "Club platform" : "Local demo"}</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-semibold ${
                  active ? "btn-shade" : "text-white/85 hover:bg-white/10"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4">
          <AppearanceToggle />
          <Link href="/" className="flex min-h-11 items-center text-sm font-bold text-emerald-300">
            Clubs
          </Link>
          {roleText ? <p className="truncate text-sm font-semibold text-white/80">{roleText}</p> : null}
          {signedIn ? <SignOutButton /> : null}
        </div>
      </aside>

      <main className="px-4 pb-32 pt-24 sm:px-6 md:pb-12 md:pl-72 md:pr-10 md:pt-10">
        <div className="relative mx-auto w-full max-w-[76rem]">
          <DemoBanner />
          <SponsorStrip />
          {children}
          <footer className="mt-12 flex flex-wrap gap-4 border-t border-slate-300 pt-4 text-sm font-semibold text-slate-600">
            <Link href="/privacy" className="underline">
              Privacy and POPIA notice
            </Link>
            <SyncIndicator />
          </footer>
        </div>
      </main>

      {items.length > 0 ? (
        <nav className="app-chrome fixed inset-x-0 bottom-0 z-30 grid border-t border-white/10 md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${
                  active ? "text-emerald-300" : "text-white/75"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function ClubMark({ club }: { club: { name: string; logo: string } }) {
  const src = club.logo;
  if (!src) {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-[#1e1d1b]">
        {(club.name || "C").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full bg-white object-contain" />;
}
