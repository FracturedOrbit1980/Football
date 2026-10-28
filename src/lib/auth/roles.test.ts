import { describe, expect, it } from "vitest";

import { allowedRolesForPath, isUserRole, usesClubScope } from "@/lib/auth/roles";

describe("roles", () => {
  it("recognises the four sign-in roles", () => {
    expect(isUserRole("HEAD_COACH")).toBe(true);
    expect(isUserRole("guest")).toBe(false);
    expect(usesClubScope("DEVELOPER")).toBe(false);
    expect(usesClubScope("PLAYER")).toBe(true);
  });

  it("locks each area to its roles", () => {
    expect(allowedRolesForPath("/admin/accounting")).toEqual(["DEVELOPER", "SUPER_ADMIN"]);
    expect(allowedRolesForPath("/coach/match/")).toEqual(["HEAD_COACH"]);
    expect(allowedRolesForPath("/player")).toEqual(["PLAYER"]);
    expect(allowedRolesForPath("/")).toBeNull();
  });
});
