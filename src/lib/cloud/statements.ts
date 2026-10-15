import type { BudgetLine, KitAllocation, KitItem, Player, SubsCharge } from "@/lib/cloud/types";
import { playerName } from "@/lib/cloud/types";

export interface StatementLine {
  date: string;
  kind: "Budget" | "Kit" | "Subs";
  description: string;
  amountCents: number;
  status: string;
}

export interface Statement {
  player: Player;
  lines: StatementLine[];
  totalCents: number;
  outstandingCents: number;
}

export function buildStatements(
  players: Player[],
  data: { budget: BudgetLine[]; kit: KitAllocation[]; kitItems: KitItem[]; subs: SubsCharge[] },
): Statement[] {
  const items = new Map(data.kitItems.map((item) => [item.id, item]));
  return players.map((player) => {
    const lines: StatementLine[] = [
      ...data.budget
        .filter((line) => line.player_id === player.id)
        .map((line) => ({
          date: line.due_on ?? "",
          kind: "Budget" as const,
          description: line.description,
          amountCents: line.amount_cents,
          status: "Budgeted",
        })),
      ...data.kit
        .filter((row) => row.player_id === player.id)
        .map((row) => {
          const item = items.get(row.kit_item_id);
          const label = item ? `${item.name}${item.size ? ` (${item.size})` : ""}` : "Kit item";
          return {
            date: row.issued_on,
            kind: "Kit" as const,
            description: `${row.quantity} × ${label}`,
            amountCents: row.quantity * row.unit_value_cents,
            status: row.returned_on ? `Returned ${row.returned_on}` : "Issued",
          };
        }),
      ...data.subs
        .filter((row) => row.player_id === player.id)
        .map((row) => ({
          date: `${row.period}-01`,
          kind: "Subs" as const,
          description: `Subs ${row.period}`,
          amountCents: row.amount_cents,
          status: row.paid ? `Paid${row.paid_on ? ` ${row.paid_on}` : ""}` : "Unpaid",
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const outstandingCents = data.subs
      .filter((row) => row.player_id === player.id && !row.paid)
      .reduce((sum, row) => sum + row.amount_cents, 0);
    return {
      player,
      lines,
      totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
      outstandingCents,
    };
  });
}

function csvCell(raw: string) {
  // Stop spreadsheet formula injection from names or descriptions.
  const value = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function statementsCsv(statements: Statement[]) {
  const rows = [["player_code", "player", "date", "type", "description", "amount_zar", "status"]];
  for (const statement of statements) {
    for (const line of statement.lines) {
      rows.push([
        statement.player.player_code,
        playerName(statement.player),
        line.date,
        line.kind,
        line.description,
        (line.amountCents / 100).toFixed(2),
        line.status,
      ]);
    }
    rows.push([statement.player.player_code, playerName(statement.player), "", "Outstanding subs", "", (statement.outstandingCents / 100).toFixed(2), ""]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
