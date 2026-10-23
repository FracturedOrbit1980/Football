"use client";

import {
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  Library,
  Pencil,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useRole } from "@/components/auth/role-session";
import { AppearanceToggle } from "@/components/layout/appearance";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ROLE_HOME, ROLE_LABEL, type UserRole } from "@/lib/auth/roles";
import { DEFAULT_CLUB_ID } from "@/lib/club/registry";
import { activeClub, useClubLibrary } from "@/stores/club-library";

const ADMIN_NAV: { href: string; label: string; icon: typeof Users }[] = [
  { href: "/admin", label: "Club", icon: LayoutDashboard },
  { href: "/admin/people", label: "People", icon: Users },
  { href: "/admin/members", label: "Members", icon: ContactRound },
  { href: "/admin/accounting", label: "Accounting", icon: Wallet },
  { href: "/admin/drills", label: "Drills", icon: Library },
];

const NAV: Record<UserRole, { href: string; label: string; icon: typeof Users }[]> = {
  DEVELOPER: ADMIN_NAV,
  SUPER_ADMIN: ADMIN_NAV,
  HEAD_COACH: [
    { href: "/coach", label: "Home", icon: LayoutDashboard },
    { href: "/coach/roster", label: "Squad", icon: Users },
    { href: "/coach/drills", label: "Drills", icon: ClipboardList },
    { href: "/coach/editor", label: "Editor", icon: Pencil },
    { href: "/coach/match", label: "Match", icon: Timer },
  ],
  PLAYER: [{ href: "/player", label: "My game", icon: Users }],
};

function stripSlash(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isActive(pathname: string, href: string) {
  const current = stripSlash(pathname);
  const target = stripSlash(href);
  if (href === ROLE_HOME.SUPER_ADMIN || href === ROLE_HOME.HEAD_COACH || href === ROLE_HOME.PLAYER) {
    return current === target;
  }
  return current === target || current.startsWith(`${target}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const items = role ? NAV[role] : [];
  const club = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const clubName = club?.name ?? "Load a club";
  const defaultBrand = !club?.logo && club?.id === DEFAULT_CLUB_ID;

  return (
    <div className="min-h-full bg-slate-100 text-slate-950">
      <header className="app-chrome fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 px-4 md:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-bold">
          {defaultBrand ? (
            <BrandLockup className="h-7" />
          ) : (
            <>
              <ClubMark club={club} />
              <span className="truncate">{clubName}</span>
            </>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <AppearanceToggle />
          {role ? <SignOutButton /> : null}
        </div>
      </header>

      <aside className="app-chrome fixed inset-y-0 left-0 z-20 hidden w-64 flex-col md:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-5">
          {defaultBrand ? (
            <span className="min-w-0">
              <BrandLockup className="h-7" />
              <span className="mt-1 block text-xs font-medium text-emerald-300">Club platform</span>
            </span>
          ) : (
            <>
              <ClubMark club={club} />
              <span>
                <span className="block text-sm font-bold leading-tight">{clubName}</span>
                <span className="text-xs font-medium text-emerald-300">Club platform</span>
              </span>
            </>
          )}
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
          {role ? <p className="text-sm font-semibold text-white/80">{ROLE_LABEL[role]}</p> : null}
          {role ? <SignOutButton /> : null}
        </div>
      </aside>

      <main className="px-4 pb-32 pt-24 sm:px-6 md:pb-12 md:pl-72 md:pr-10 md:pt-10">
        <div className="mx-auto w-full max-w-[76rem]">{children}</div>
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

function BrandLockup({ className }: { className: string }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return <img src={`${base}/icons/clubstride-lockup-dark.svg`} alt="Clubstride" className={`w-auto ${className}`} />;
}

function ClubMark({ club }: { club: ReturnType<typeof activeClub> }) {
  const src = club?.logo || "";
  if (!src) {
    return (
      <span className="club-mark grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-white">
        {(club?.name ?? "C").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" width={40} height={40} className="club-mark logo-plate size-10 shrink-0 rounded-full object-contain" />;
}
