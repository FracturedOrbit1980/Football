/** Team id used by the old built-in demo squad. Kept so older saved data still resolves. */
export const SQUAD_TEAM_ID = "tm-u12-2015";

export interface RosterRow {
  name: string;
  squadNumber: number;
}

export function playerId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `p-${slug || "player"}`;
}

/**
 * Fingerprints (FNV-1a of "lowercased name|squad number") of a demo squad that
 * earlier builds seeded into browser storage. Only hashes are kept so no names
 * ship in the app. Saved players that still match are removed on load.
 */
const RETIRED_SEED_FINGERPRINTS = new Set([
  "6f3cb595", "9e8bc23a", "06d699b1", "2ac78004", "d7f42854", "a180cee6",
  "64f05575", "889e3f5d", "c604f95c", "e0a3a75c", "867308b6", "64e3ed42",
]);

function fingerprint(value: string) {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function isRetiredSeedPlayer(player: { name: string; squadNumber: number }) {
  const key = `${player.name.trim().toLowerCase().replace(/\s+/g, " ")}|${player.squadNumber}`;
  return RETIRED_SEED_FINGERPRINTS.has(fingerprint(key));
}

export function parseRoster(text: string): { rows: RosterRow[]; errors: string[] } {
  const rows: RosterRow[] = [];
  const errors: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const cells = splitRow(line);
    if (isHeader(cells)) return;
    const parsed = interpretRow(cells);
    if ("error" in parsed) errors.push(`Line ${index + 1}: ${parsed.error}`);
    else rows.push(parsed);
  });
  return { rows, errors };
}

function splitRow(line: string) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim()).filter((cell, index, all) => cell.length > 0 || index < all.length - 1);
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = false;
      } else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  if (cells.filter(Boolean).length > 1) return cells.map((cell) => cell.trim());
  return [line.trim()];
}

function isHeader(cells: string[]) {
  const first = cells[0]?.trim().toLowerCase() ?? "";
  return first === "name" || first === "player" || first === "player name";
}

function interpretRow(cells: string[]): RosterRow | { error: string } {
  const filled = cells.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length === 1) {
    const dated = filled[0].match(/^(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2})$/);
    if (dated) return rowFrom(dated[1], dated[3]);
    const numbered = filled[0].match(/^(.+?)\s+(\d{1,2})$/);
    if (numbered) return rowFrom(numbered[1], numbered[2]);
    return { error: "Add the player name and shirt number." };
  }
  const [name, second, third] = filled;
  if (!name) return { error: "Add the player name." };
  if (isDate(second) && third && isShirt(third)) return rowFrom(name, third);
  if (isShirt(second)) return rowFrom(name, second);
  return { error: "Use the player name and shirt number." };
}

function rowFrom(name: string, shirt: string): RosterRow | { error: string } {
  const squadNumber = Number(shirt);
  if (!isShirt(shirt)) return { error: "Shirt number must be from 1 to 99." };
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { error: "Add the player name." };
  return { name: trimmed, squadNumber };
}

function isShirt(value: string) {
  return /^\d{1,2}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 99;
}

function isDate(value: string) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim());
}
