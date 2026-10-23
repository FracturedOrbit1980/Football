"use client";

import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-session";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return <RoleGate allow={["HEAD_COACH"]}>{children}</RoleGate>;
}
