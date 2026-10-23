"use client";

import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-session";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return <RoleGate allow={["PLAYER"]}>{children}</RoleGate>;
}
