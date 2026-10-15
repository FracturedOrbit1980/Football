"use client";

import { useState } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { CloudGate, Field, Notice, Panel, Select } from "@/components/cloud/cloud-ui";
import { must, useClubData } from "@/components/cloud/use-club-data";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import { formatZar, parseRandToCents } from "@/lib/cloud/money";
import { buildStatements, downloadText, statementsCsv, type Statement } from "@/lib/cloud/statements";
import {
  playerName,
  type BudgetLine,
  type KitAllocation,
  type KitItem,
  type Player,
  type Sponsor,
  type SubsCharge,
  type Team,
} from "@/lib/cloud/types";

type Data = {
  players: Player[];
  teams: Team[];
  budget: BudgetLine[];
  kit: KitAllocation[];
  kitItems: KitItem[];
  subs: SubsCharge[];
  sponsors: Sponsor[];
};

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function ClubFinance() {
  return (
    <CloudGate roles={["CLUB_ADMIN", "TEAM_MANAGER"]}>
      <FinanceScreen />
    </CloudGate>
  );
}

function FinanceScreen() {
  const session = useCloudSession();
  const isAdmin = session.hasRole("CLUB_ADMIN");
  const { data, error, reload, clubId } = useClubData<Data>(
    async (cloud, club) => {
      const [players, teams, budget, kit, kitItems, subs, sponsors] = await Promise.all([
        cloud.from("players").select("*").eq("club_id", club).order("last_name"),
        cloud.from("teams").select("*").eq("club_id", club).order("name"),
        cloud.from("budget_lines").select("*").eq("club_id", club),
        cloud.from("kit_allocations").select("*").eq("club_id", club),
        cloud.from("kit_items").select("*").eq("club_id", club).order("name"),
        cloud.from("subs_charges").select("*").eq("club_id", club).order("period", { ascending: false }),
        cloud.from("sponsors").select("*").eq("club_id", club).eq("active", true).eq("placement", "STATEMENT"),
      ]);
      return {
        players: must<Player[]>(players),
        teams: must<Team[]>(teams),
        budget: must<BudgetLine[]>(budget),
        kit: must<KitAllocation[]>(kit),
        kitItems: must<KitItem[]>(kitItems),
        subs: must<SubsCharge[]>(subs),
        sponsors: must<Sponsor[]>(sponsors),
      };
    },
    { players: [], teams: [], budget: [], kit: [], kitItems: [], subs: [], sponsors: [] },
  );
  const cloud = getCloud()!;
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [selected, setSelected] = useState("");
  const [printing, setPrinting] = useState<Statement[] | null>(null);
  // Forms
  const [item, setItem] = useState({ name: "", size: "", value: "" });
  const [budget, setBudget] = useState({ description: "", amount: "", due: "" });
  const [alloc, setAlloc] = useState({ item: "", quantity: "1" });
  const [subsRun, setSubsRun] = useState({ period: thisMonth(), amount: "" });

  async function run(action: () => PromiseLike<{ error: unknown }>, done: string) {
    setFailure("");
    const { error: problem } = await action();
    if (problem) {
      setFailure(errorText(problem));
      return false;
    }
    setNotice(done);
    reload();
    return true;
  }

  const filtered = data.players.filter((player) => {
    if (teamFilter && player.team_id !== teamFilter) return false;
    if (unpaidOnly && !data.subs.some((row) => row.player_id === player.id && !row.paid)) return false;
    return true;
  });
  const statements = buildStatements(filtered, data);
  const player = data.players.find((row) => row.id === selected);
  const clubName = session.activeClub?.name ?? "Club";

  function printStatements(rows: Statement[]) {
    setPrinting(rows);
    setTimeout(() => {
      window.print();
      setPrinting(null);
    }, 50);
  }

  return (
    <>
      <Notice text={error} tone="error" />
      <Notice text={notice} />
      <Notice text={failure} tone="error" />

      <Panel title="Statement run">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Team" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="">All players I can see</option>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 self-end text-sm font-semibold text-slate-800">
            <input type="checkbox" className="size-5" checked={unpaidOnly} onChange={(event) => setUnpaidOnly(event.target.checked)} />
            Only players with unpaid subs
          </label>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {statements.length} statements · outstanding {formatZar(statements.reduce((sum, row) => sum + row.outstandingCents, 0))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" className="h-11" disabled={statements.length === 0} onClick={() => downloadText(`statements-${thisMonth()}.csv`, statementsCsv(statements))}>
            Download CSV
          </Button>
          <Button type="button" variant="secondary" className="h-11" disabled={statements.length === 0} onClick={() => printStatements(statements)}>
            Print or save as PDF
          </Button>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-600">To get a PDF, choose “Save as PDF” in the print dialog. Each statement starts on a new page.</p>
      </Panel>

      <Panel title="Subs run">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const cents = parseRandToCents(subsRun.amount);
            if (cents === null) {
              setFailure("Enter the subs amount in rand, e.g. 250 or 250.50.");
              return;
            }
            const rows = filtered.map((row) => ({ club_id: clubId, player_id: row.id, period: subsRun.period, amount_cents: cents }));
            await run(
              () => cloud.from("subs_charges").upsert(rows, { onConflict: "player_id,period", ignoreDuplicates: true }),
              `Subs for ${subsRun.period} added for ${rows.length} players (existing charges kept).`,
            );
          }}
        >
          <Field label="Month" type="month" required value={subsRun.period} onChange={(event) => setSubsRun({ ...subsRun, period: event.target.value })} />
          <Field label="Amount (R)" required inputMode="decimal" value={subsRun.amount} onChange={(event) => setSubsRun({ ...subsRun, amount: event.target.value })} />
          <Button type="submit" className="h-11 self-end" disabled={filtered.length === 0}>Charge {filtered.length} filtered players</Button>
        </form>
      </Panel>

      {isAdmin ? (
        <Panel title="Kit items and values">
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const cents = parseRandToCents(item.value);
              if (cents === null) {
                setFailure("Enter the item value in rand.");
                return;
              }
              if (await run(() => cloud.from("kit_items").insert({ club_id: clubId, name: item.name.trim(), size: item.size.trim(), unit_value_cents: cents }), "Kit item added."))
                setItem({ name: "", size: "", value: "" });
            }}
          >
            <Field label="Item" required placeholder="Home shirt" value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} />
            <Field label="Size" value={item.size} onChange={(event) => setItem({ ...item, size: event.target.value })} />
            <Field label="Value (R)" required inputMode="decimal" value={item.value} onChange={(event) => setItem({ ...item, value: event.target.value })} />
            <Button type="submit" className="h-11 self-end">Add item</Button>
          </form>
          <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-900">
            {data.kitItems.map((row) => (
              <li key={row.id}>{row.name}{row.size ? ` (${row.size})` : ""} · {formatZar(row.unit_value_cents)}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Player account">
        <Select label="Player" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose…</option>
          {data.players.map((row) => (
            <option key={row.id} value={row.id}>{playerName(row)} · {row.player_code}</option>
          ))}
        </Select>
        {player ? (
          <div className="mt-4 space-y-5">
            <form
              className="grid gap-3 sm:grid-cols-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const cents = parseRandToCents(budget.amount);
                if (cents === null) {
                  setFailure("Enter the budget amount in rand.");
                  return;
                }
                if (await run(() => cloud.from("budget_lines").insert({ club_id: clubId, player_id: player.id, description: budget.description.trim(), amount_cents: cents, due_on: budget.due || null }), "Budget line added."))
                  setBudget({ description: "", amount: "", due: "" });
              }}
            >
              <Field label="Budget line" required placeholder="Tour fee" value={budget.description} onChange={(event) => setBudget({ ...budget, description: event.target.value })} />
              <Field label="Amount (R)" required inputMode="decimal" value={budget.amount} onChange={(event) => setBudget({ ...budget, amount: event.target.value })} />
              <Field label="Due" type="date" value={budget.due} onChange={(event) => setBudget({ ...budget, due: event.target.value })} />
              <Button type="submit" className="h-11 self-end">Add budget line</Button>
            </form>
            <form
              className="grid gap-3 sm:grid-cols-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const kitItem = data.kitItems.find((row) => row.id === alloc.item);
                if (!kitItem) return;
                await run(
                  () => cloud.from("kit_allocations").insert({ club_id: clubId, player_id: player.id, kit_item_id: kitItem.id, quantity: Number(alloc.quantity) || 1, unit_value_cents: kitItem.unit_value_cents }),
                  "Kit allocated.",
                );
              }}
            >
              <Select label="Kit item" required value={alloc.item} onChange={(event) => setAlloc({ ...alloc, item: event.target.value })}>
                <option value="">Choose…</option>
                {data.kitItems.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}{row.size ? ` (${row.size})` : ""} · {formatZar(row.unit_value_cents)}</option>
                ))}
              </Select>
              <Field label="Quantity" type="number" min={1} value={alloc.quantity} onChange={(event) => setAlloc({ ...alloc, quantity: event.target.value })} />
              <Button type="submit" className="h-11 self-end">Allocate kit</Button>
            </form>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Subs</h3>
              <ul className="mt-1 space-y-1">
                {data.subs.filter((row) => row.player_id === player.id).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-900">
                    {row.period} · {formatZar(row.amount_cents)} · {row.paid ? `Paid ${row.paid_on ?? ""}` : "Unpaid"}
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11"
                      onClick={() =>
                        run(
                          () => cloud.from("subs_charges").update({ paid: !row.paid, paid_on: row.paid ? null : new Date().toISOString().slice(0, 10) }).eq("id", row.id),
                          row.paid ? "Marked unpaid." : "Marked paid.",
                        )
                      }
                    >
                      Mark {row.paid ? "unpaid" : "paid"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            {buildStatements([player], data).map((statement) => (
              <div key={statement.player.id}>
                <StatementView statement={statement} clubName={clubName} sponsors={data.sponsors} />
                <Button type="button" variant="secondary" className="mt-2 h-11" onClick={() => printStatements([statement])}>Print this statement</Button>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      {printing ? (
        <div className="print-area">
          {printing.map((statement) => (
            <div key={statement.player.id} className="statement-page">
              <StatementView statement={statement} clubName={clubName} sponsors={data.sponsors} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function StatementView({ statement, clubName, sponsors }: { statement: Statement; clubName: string; sponsors: Sponsor[] }) {
  return (
    <article className="rounded-lg bg-white p-4 text-slate-950 ring-1 ring-slate-200">
      <header className="mb-3">
        <p className="text-lg font-black">{clubName} · Player statement</p>
        <p className="text-sm font-semibold">
          {playerName(statement.player)} · {statement.player.player_code} · {new Date().toISOString().slice(0, 10)}
        </p>
      </header>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="py-1">Date</th>
            <th>Type</th>
            <th>Description</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {statement.lines.map((line, index) => (
            <tr key={index} className="border-b border-slate-100">
              <td className="py-1">{line.date}</td>
              <td>{line.kind}</td>
              <td>{line.description}</td>
              <td className="text-right">{formatZar(line.amountCents)}</td>
              <td>{line.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right font-bold">Outstanding subs: {formatZar(statement.outstandingCents)}</p>
      {sponsors.length > 0 ? (
        <p className="mt-2 text-xs font-semibold text-slate-600">Supported by {sponsors.map((sponsor) => sponsor.name).join(", ")}</p>
      ) : null}
    </article>
  );
}
