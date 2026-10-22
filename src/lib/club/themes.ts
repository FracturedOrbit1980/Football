export const CLUB_THEMES = [
  { id: "red", name: "Clubstride", swatch: "#0f766e" },
  { id: "navy", name: "Navy", swatch: "#2f6fad" },
  { id: "green", name: "Green", swatch: "#1f8a4c" },
  { id: "gold", name: "Gold", swatch: "#c9a227" },
  { id: "blue", name: "Royal blue", swatch: "#3b4cc0" },
] as const;

export type ClubThemeId = (typeof CLUB_THEMES)[number]["id"];

export function isClubTheme(value: string): value is ClubThemeId {
  return CLUB_THEMES.some((theme) => theme.id === value);
}
