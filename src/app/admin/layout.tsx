"use client";

import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-session";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGate allow={["DEVELOPER", "SUPER_ADMIN"]}>{children}</RoleGate>;
}
