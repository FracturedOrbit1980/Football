"use client";

import { useRole } from "@/components/auth/role-session";
import { ROLE_LABEL, type UserRole } from "@/lib/auth/roles";

const ROLES: { role: UserRole; detail: string }[] = [
  {
    role: "SUPER_ADMIN",
    detail: "Players, teams, fees, and the drill library.",
  },
  {
    role: "HEAD_COACH",
    detail: "Squad, drills, and the match clock.",
  },
  {
    role: "PLAYER",
    detail: "Your ratings, homework, and attendance.",
  },
  {
    role: "DEVELOPER",
    detail: "Every club on this device, with balances.",
  },
];

export function RolePicker() {
  const { signIn } = useRole();

  return (
    <div className="grid gap-3">
      {ROLES.map((item) => (
        <button
          key={item.role}
          type="button"
          onClick={() => signIn(item.role)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left ring-1 ring-slate-300"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-slate-950">{ROLE_LABEL[item.role]}</span>
            <span className="mt-0.5 block text-sm font-medium leading-snug text-slate-600">{item.detail}</span>
          </span>
          <span className="btn-shade inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-bold">Open</span>
        </button>
      ))}
    </div>
  );
}
