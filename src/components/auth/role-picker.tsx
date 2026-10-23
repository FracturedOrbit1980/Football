"use client";

import { useRole } from "@/components/auth/role-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABEL, type UserRole } from "@/lib/auth/roles";

const ROLES: { role: UserRole; detail: string }[] = [
  {
    role: "SUPER_ADMIN",
    detail: "The club you registered only: players, teams, fees, and the drill library.",
  },
  {
    role: "HEAD_COACH",
    detail: "Coach the allocated team: attendance, drills, and the match clock.",
  },
  {
    role: "PLAYER",
    detail: "Your profile, homework, and attendance once you are on a squad.",
  },
  {
    role: "DEVELOPER",
    detail: "Every registered club, with the club list and balances across all of them.",
  },
];

export function RolePicker() {
  const { signIn } = useRole();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      {ROLES.map((item) => (
        <Card key={item.role}>
          <CardHeader>
            <CardTitle>{ROLE_LABEL[item.role]}</CardTitle>
            <CardDescription className="text-slate-700">{item.detail}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" size="lg" className="h-11 w-full text-base" onClick={() => signIn(item.role)}>
              Open {ROLE_LABEL[item.role].toLowerCase()}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
