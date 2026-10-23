const REG_PATTERN = /^REG-(\d{4,})$/;

export function formatRegNumber(value: number) {
  return `REG-${String(Math.max(1, Math.round(value))).padStart(4, "0")}`;
}

export function isRegNumber(value: unknown): value is string {
  return typeof value === "string" && REG_PATTERN.test(value.trim().toUpperCase());
}

export function nextRegNumber(players: { regNumber?: string }[]) {
  let highest = 0;
  for (const player of players) {
    const match = REG_PATTERN.exec((player.regNumber ?? "").trim().toUpperCase());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return formatRegNumber(highest + 1);
}

export function ensureRegNumbers<T extends { regNumber?: string }>(players: T[]): T[] {
  const used = new Set<string>();
  let highest = 0;
  for (const player of players) {
    const reg = (player.regNumber ?? "").trim().toUpperCase();
    const match = REG_PATTERN.exec(reg);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return players.map((player) => {
    const reg = (player.regNumber ?? "").trim().toUpperCase();
    if (REG_PATTERN.test(reg) && !used.has(reg)) {
      used.add(reg);
      return { ...player, regNumber: reg };
    }
    highest += 1;
    const next = formatRegNumber(highest);
    used.add(next);
    return { ...player, regNumber: next };
  });
}

export function splitName(fullName: string) {
  const clean = fullName.trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "", surname: "" };
  const index = clean.lastIndexOf(" ");
  if (index < 0) return { firstName: clean, surname: "" };
  return { firstName: clean.slice(0, index), surname: clean.slice(index + 1) };
}

export function joinName(firstName: string, surname: string) {
  return [firstName.trim(), surname.trim()].filter(Boolean).join(" ");
}

export function normalizeIdentity(value: unknown, max = 24) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

interface SearchablePlayer {
  regNumber?: string;
  name: string;
  firstName?: string;
  surname?: string;
  idNumber?: string;
  mobile?: string;
  guardianName?: string;
  guardianEmail?: string;
  squadNumber: number;
}

export function playerSearchScore(player: SearchablePlayer, query: string, teamLabel = "") {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const compact = query.trim().toLowerCase().replace(/\s+/g, " ");
  const compactDigits = digitsOf(compact);
  const reg = (player.regNumber ?? "").toLowerCase();
  const name = player.name.toLowerCase();
  const first = (player.firstName ?? "").toLowerCase();
  const surname = (player.surname ?? "").toLowerCase();
  const id = (player.idNumber ?? "").toLowerCase();
  const mobile = (player.mobile ?? "").toLowerCase();
  const text = [
    reg,
    name,
    first,
    surname,
    id,
    mobile,
    player.guardianName ?? "",
    player.guardianEmail ?? "",
    String(player.squadNumber),
    teamLabel,
  ]
    .join(" ")
    .toLowerCase();
  const numbers = [reg, id, mobile, String(player.squadNumber)].map(digitsOf).join(" ");

  for (const term of terms) {
    const digits = digitsOf(term);
    if (!text.includes(term) && !(digits.length >= 2 && numbers.includes(digits))) return -1;
  }

  let score = 0;
  if (reg === compact) score += 120;
  else if (reg.replace(/\D/g, "") === compactDigits && compactDigits) score += 110;
  if (id && compactDigits && digitsOf(id) === compactDigits) score += 100;
  if (mobile && compactDigits && digitsOf(mobile) === compactDigits) score += 90;
  if (name === compact) score += 80;
  else if (name.startsWith(compact)) score += 50;
  if (first.startsWith(compact) || surname.startsWith(compact)) score += 40;
  if (text.includes(compact)) score += 10;
  return score;
}

export function searchPlayers<T extends SearchablePlayer>(
  players: T[],
  query: string,
  teamLabel?: (player: T) => string,
) {
  if (!query.trim()) return [...players];
  return players
    .map((player) => ({ player, score: playerSearchScore(player, query, teamLabel?.(player)) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name))
    .map((entry) => entry.player);
}
