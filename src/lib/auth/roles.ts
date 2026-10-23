export const USER_ROLES = ["DEVELOPER", "SUPER_ADMIN", "HEAD_COACH", "PLAYER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const CLUB_ROLE_COOKIE = "bnfc-role";

export const ROLE_HOME: Record<UserRole, string> = {
  DEVELOPER: "/admin",
  SUPER_ADMIN: "/admin",
  HEAD_COACH: "/coach",
  PLAYER: "/player",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  DEVELOPER: "Developer",
  SUPER_ADMIN: "Club admin",
  HEAD_COACH: "Head coach",
  PLAYER: "Player",
};

export const PROTECTED_ROUTES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["DEVELOPER", "SUPER_ADMIN"] },
  { prefix: "/coach", roles: ["HEAD_COACH"] },
  { prefix: "/player", roles: ["PLAYER"] },
];

export function isUserRole(value: string | undefined | null): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function usesClubScope(role: UserRole | null): boolean {
  return role !== null && role !== "DEVELOPER";
}

export function allowedRolesForPath(pathname: string): UserRole[] | null {
  const match = PROTECTED_ROUTES.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
  return match?.roles ?? null;
}
