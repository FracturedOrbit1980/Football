"use client";

import { useState } from "react";

import { PlayerPortrait } from "@/components/club/player-photo";
import { Button } from "@/components/ui/button";
import { ageAnalysis, bucketOf, creditOf, daysOverdue, isIsoDate, outstandingOf, paidTotal, rand, todayIso, AGE_BUCKETS } from "@/lib/club/accounting";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import type { ClubPlayer, PaymentRecord } from "@/lib/club/seed";
import { formatDay } from "@/lib/club/week";
import { useClubStore } from "@/stores/club-store";
import { activeClub, useClubLibrary } from "@/stores/club-library";

type FeeStatus = "No fee set" | "Awaiting payment" | "Part paid" | "Paid";

function statusFrom(fee: number, paid: number): FeeStatus {
  if (fee <= 0) return "No fee set";
  if (paid >= fee) return "Paid";
  if (paid > 0) return "Part paid";
  return "Awaiting payment";
}

const STATUS_STYLE: Record<FeeStatus, string> = {
  "No fee set": "bg-slate-100 text-slate-700",
  "Awaiting payment": "bg-rose-100 text-rose-900",
  "Part paid": "bg-amber-100 text-amber-950",
  Paid: "bg-emerald-100 text-emerald-900",
};

export function AccountingBoard() {
  const players = useClubStore((state) => state.players);
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const club = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const clubName = club?.name ?? "Clubstride";
  const [filter, setFilter] = useState("");
  const teams = ageGroups.flatMap((group) =>
    group.teams.map((team) => ({ ...team, label: `${ageLabel(group.name)} · ${team.division ?? team.name}` })),
  );
  const filterLabel =
    filter === "none"
      ? "players not on a team"
      : filter
        ? teams.find((team) => team.id === filter)?.label ?? "this team"
        : "the whole club";
  const visible = players
    .filter((player) => (filter === "" ? true : filter === "none" ? !player.teamId : player.teamId === filter))
    .slice()
    .sort((a, b) => a.squadNumber - b.squadNumber || a.name.localeCompare(b.name));
  const totals = visible.reduce(
    (sum, player) => ({
      billed: sum.billed + player.seasonFee,
      received: sum.received + paidTotal(player),
      outstanding: sum.outstanding + outstandingOf(player),
    }),
    { billed: 0, received: 0, outstanding: 0 },
  );
  const awaiting = visible.filter((player) => player.seasonFee > 0 && outstandingOf(player) > 0).length;
  const ageing = ageAnalysis(visible);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
        <label className="block max-w-sm text-sm font-semibold text-slate-800">
          Show
          <select
            value={filter}
            data-field="accounting-filter"
            onChange={(event) => setFilter(event.target.value)}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base"
          >
            <option value="">All teams</option>
            <option value="none">Not on a team yet</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-sm font-medium text-slate-600">
          Record the season fee, its due date, and every payment received. Outstanding is the fee less what was paid.
          Totals and the age analysis below cover {filterLabel}.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Accounting totals">
        <Total label="Season fees" value={rand(totals.billed)} />
        <Total label="Received" value={rand(totals.received)} />
        <Total label="Outstanding" value={rand(totals.outstanding)} emphasis />
        <Total label="Accounts awaiting" value={String(awaiting)} />
      </section>

      <section aria-label="Age analysis">
        <h2 className="text-lg font-bold text-slate-950">Age analysis</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Outstanding money by how long it is past its due date. Use this to chase the oldest accounts first.
        </p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" data-age-analysis>
          {AGE_BUCKETS.map((bucket) => (
            <li key={bucket} className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-age-bucket={bucket}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{bucket}</p>
              <p className="mt-1 text-xl font-black tabular-nums text-slate-950">{rand(ageing[bucket].amount)}</p>
              <p className="text-xs font-semibold text-slate-600">
                {ageing[bucket].count} {ageing[bucket].count === 1 ? "account" : "accounts"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-950">
          Player accounts
          <span className="ml-2 text-sm font-semibold text-slate-500">{visible.length}</span>
        </h2>
        {visible.length === 0 ? (
          <p className="mt-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">
            No players match this filter. Register players on People, then set their fee here.
          </p>
        ) : (
          <ul className="mt-2 space-y-3" data-accounting-list>
            {visible.map((player) => (
              <AccountRow
                key={player.id}
                player={player}
                clubName={clubName}
                teamLabel={teams.find((team) => team.id === player.teamId)?.label ?? "Not on a team yet"}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Total({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-xl bg-white p-4 ring-1 ${emphasis ? "ring-2 ring-amber-400" : "ring-slate-300"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function AccountRow({ player, clubName, teamLabel }: { player: ClubPlayer; clubName: string; teamLabel: string }) {
  const setPlayerAccount = useClubStore((state) => state.setPlayerAccount);
  const [fee, setFee] = useState(String(player.seasonFee));
  const [dueDate, setDueDate] = useState(player.feeDueDate);
  const [guardianName, setGuardianName] = useState(player.guardianName);
  const [guardianEmail, setGuardianEmail] = useState(player.guardianEmail);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("");
  const feeValue = Math.max(0, Math.round(Number(fee) || 0));
  const paid = paidTotal(player);
  const preview: ClubPlayer = {
    ...player,
    seasonFee: feeValue,
    feeDueDate: isIsoDate(dueDate) ? dueDate : feeValue > 0 ? todayIso() : "",
  };
  const outstanding = outstandingOf(preview);
  const days = daysOverdue(preview);
  const status = statusFrom(feeValue, paid);

  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-account={player.name}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-950">
              {player.squadNumber} {player.name}
            </p>
            <p className="text-sm font-medium text-slate-600">{teamLabel}</p>
          </div>
        </div>
        <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-700" data-account-ageing>
        {feeValue <= 0
          ? "No season fee set yet."
          : !isIsoDate(preview.feeDueDate)
            ? "Set a due date to age this account."
            : outstanding <= 0
              ? `Due ${formatDay(preview.feeDueDate)} · settled.`
              : days > 0
                ? `Due ${formatDay(preview.feeDueDate)} · ${days} ${days === 1 ? "day" : "days"} overdue (${bucketOf(days)}).`
                : `Due ${formatDay(preview.feeDueDate)} · not yet due.`}
      </p>

      <form
        className="mt-3 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const nextDue = isIsoDate(dueDate) ? dueDate : feeValue > 0 ? todayIso() : "";
          setPlayerAccount(player.id, { seasonFee: feeValue, feeDueDate: nextDue, guardianName, guardianEmail });
          setDueDate(nextDue);
          setSaved("Account details saved.");
        }}
      >
        <label className="block text-sm font-semibold text-slate-800">
          Season fee
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={fee}
            data-field={`fee-${player.id}`}
            onChange={(event) => {
              setFee(event.target.value);
              setSaved("");
            }}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Due date
          <input
            type="date"
            value={dueDate}
            data-field={`due-${player.id}`}
            onChange={(event) => {
              setDueDate(event.target.value);
              setSaved("");
            }}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Guardian
          <input
            value={guardianName}
            data-field={`guardian-${player.id}`}
            placeholder="Guardian name"
            onChange={(event) => {
              setGuardianName(event.target.value);
              setSaved("");
            }}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Guardian email
          <input
            type="email"
            value={guardianEmail}
            data-field={`guardian-email-${player.id}`}
            placeholder="name@example.com"
            onChange={(event) => {
              setGuardianEmail(event.target.value);
              setSaved("");
            }}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <Button type="submit" size="lg" className="h-11">
          Save
        </Button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-semibold text-slate-700">
        <span>
          Received <span className="tabular-nums text-slate-950">{rand(paid)}</span>
        </span>
        <span>
          Outstanding <span className="tabular-nums text-slate-950">{rand(outstanding)}</span>
        </span>
        {saved ? <span className="text-emerald-800">{saved}</span> : null}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close statement" : "Statement and payments"}
        </Button>
      </div>
      {open ? (
        <StatementPanel player={player} clubName={clubName} teamLabel={teamLabel} guardianName={guardianName} />
      ) : null}
    </li>
  );
}

function StatementPanel({
  player,
  clubName,
  teamLabel,
  guardianName,
}: {
  player: ClubPlayer;
  clubName: string;
  teamLabel: string;
  guardianName: string;
}) {
  const recordPayment = useClubStore((state) => state.recordPayment);
  const removePayment = useClubStore((state) => state.removePayment);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmPayment, setConfirmPayment] = useState("");
  const paid = paidTotal(player);
  const outstanding = outstandingOf(player);
  const credit = creditOf(player);
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const balanceLine = statementBalanceLine(player);
  const subject = `Statement of account — ${player.name}`;
  const body = statementText(player, clubName, teamLabel, guardianName || player.guardianName);
  const mailto = player.guardianEmail
    ? `mailto:${player.guardianEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "";

  return (
    <section className="mt-3 space-y-4 border-t border-slate-200 pt-3" data-statement={player.id}>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Payments</h3>
        {payments.length === 0 ? (
          <p className="mt-1 text-sm font-medium text-slate-600">No payments recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2" data-payment>
                <span className="text-sm font-semibold text-slate-900">{formatDay(payment.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-black tabular-nums text-slate-950">{rand(payment.amount)}</span>
                  <Button
                    type="button"
                    size="lg"
                    variant={confirmPayment === payment.id ? "destructive" : "outline"}
                    className="h-11"
                    onClick={() => {
                      if (confirmPayment === payment.id) {
                        removePayment(player.id, payment.id);
                        setConfirmPayment("");
                        setNotice("Payment removed.");
                      } else {
                        setConfirmPayment(payment.id);
                      }
                    }}
                  >
                    {confirmPayment === payment.id ? "Confirm remove" : "Remove"}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Math.round(Number(amount) || 0);
            if (value <= 0) {
              setError("Enter a payment amount above zero.");
              return;
            }
            recordPayment(player.id, value, date);
            setAmount("");
            setNotice("Payment recorded.");
            setError("");
          }}
        >
          <label className="block text-sm font-semibold text-slate-800">
            Amount received
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={amount}
              data-field="payment-amount"
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
              }}
              className="mt-1 block h-11 w-32 rounded-md border border-slate-300 px-3 text-base tabular-nums"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Date received
            <input
              type="date"
              value={date}
              data-field="payment-date"
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 block h-11 rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <Button type="submit" size="lg" className="h-11">
            Record payment
          </Button>
        </form>
        {notice ? <p className="mt-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}
        {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>

      <div className="rounded-xl bg-slate-100 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Statement preview</h3>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2" data-statement-preview>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt className="font-medium text-slate-700">Season fee {player.feeDueDate ? `(due ${formatDay(player.feeDueDate)})` : ""}</dt>
            <dd className="tabular-nums font-bold text-slate-950">{rand(player.seasonFee)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt className="font-medium text-slate-700">Payments received ({payments.length})</dt>
            <dd className="tabular-nums font-bold text-slate-950">{rand(paid)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-300 pt-1 sm:col-span-2">
            <dt className="font-bold text-slate-900">Balance outstanding</dt>
            <dd className="tabular-nums font-black text-slate-950">{rand(outstanding)}</dd>
          </div>
          {credit > 0 ? (
            <p className="text-sm font-semibold text-emerald-800 sm:col-span-2">In credit by {rand(credit)}.</p>
          ) : null}
        </dl>
        <p className="mt-2 text-sm font-medium text-slate-700">{balanceLine}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="h-11"
            onClick={() => {
              const printed = printStatement(player, clubName, teamLabel, guardianName || player.guardianName);
              if (!printed) setError("Allow pop-ups to print the statement.");
            }}
          >
            Print statement
          </Button>
          {mailto ? (
            <Button asChild size="lg" variant="outline" className="h-11">
              <a href={mailto} data-field="email-guardian">
                Email guardian
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-11"
              onClick={() => setError("Add the guardian's email above and save it first.")}
            >
              Email guardian
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs font-medium text-slate-600">
          Email opens your mail app with the statement ready to send. Nothing is sent automatically.
        </p>
      </div>
      <p className="text-sm font-medium text-slate-600">
        {guardianName || player.guardianName ? `Addressed to ${guardianName || player.guardianName}.` : "Add a guardian name above so the statement is addressed correctly."}
        {player.guardianEmail ? ` ${player.guardianEmail}` : " Add the guardian's email to enable sending."}
      </p>
    </section>
  );
}

function statementBalanceLine(player: ClubPlayer) {
  const outstanding = outstandingOf(player);
  if (outstanding <= 0) {
    const credit = creditOf(player);
    return credit > 0 ? `This account is in credit by ${rand(credit)}.` : "This account is settled. Thank you.";
  }
  if (!isIsoDate(player.feeDueDate)) return `Please arrange payment of ${rand(outstanding)}.`;
  const days = daysOverdue(player);
  if (days <= 0) return `A balance of ${rand(outstanding)} is not yet due.`;
  return `A balance of ${rand(outstanding)} is ${days} ${days === 1 ? "day" : "days"} overdue (${bucketOf(days)}).`;
}

function statementText(player: ClubPlayer, clubName: string, teamLabel: string, guardian: string) {
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    clubName,
    `Statement of account — ${player.name}`,
    "",
    `Guardian: ${guardian || "Not recorded"}`,
    `Team: ${teamLabel}`,
    `Statement date: ${formatDay(todayIso())}`,
    "",
    player.feeDueDate
      ? `Season registration fee (due ${formatDay(player.feeDueDate)}): ${rand(player.seasonFee)}`
      : `Season registration fee: ${rand(player.seasonFee)}`,
    "",
    payments.length ? "Payments received:" : "No payments received.",
    ...payments.map((payment) => `  ${formatDay(payment.date)}: ${rand(payment.amount)}`),
    "",
    `Total received: ${rand(paidTotal(player))}`,
    `Balance outstanding: ${rand(outstandingOf(player))}`,
    statementBalanceLine(player),
    "",
    "Please contact the club if you have any questions about this statement.",
  ];
  return lines.join("\n");
}

function printStatement(player: ClubPlayer, clubName: string, teamLabel: string, guardian: string) {
  const win = window.open("", "_blank", "width=760,height=900");
  if (!win) return false;
  win.document.write(statementHtml(player, clubName, teamLabel, guardian));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
  return true;
}

function statementHtml(player: ClubPlayer, clubName: string, teamLabel: string, guardian: string) {
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date));
  const rows = [
    `<tr><td>${player.feeDueDate ? escapeHtml(formatDay(player.feeDueDate)) : "—"}</td><td>Season registration fee</td><td class="num">${escapeHtml(rand(player.seasonFee))}</td></tr>`,
    ...payments.map(
      (payment: PaymentRecord) =>
        `<tr><td>${escapeHtml(formatDay(payment.date))}</td><td>Payment received</td><td class="num">− ${escapeHtml(rand(payment.amount))}</td></tr>`,
    ),
  ].join("");
  const balanceLabel = creditOf(player) > 0 ? "In credit" : "Outstanding";
  const balanceAmount = creditOf(player) > 0 ? rand(creditOf(player)) : rand(outstandingOf(player));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Statement — ${escapeHtml(player.name)}</title>
<style>
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0b1b33; margin: 32px; line-height: 1.45; }
  header { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 24px; }
  .brand { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; font-weight: 700; }
  h1 { font-size: 24px; margin: 6px 0 0; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 0 0 24px; font-size: 14px; }
  .meta dt { color: #475569; font-weight: 600; margin: 0; }
  .meta dd { margin: 0 0 8px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
  th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total td { border-top: 2px solid #0b1b33; border-bottom: none; font-weight: 800; font-size: 15px; }
  .note { margin-top: 20px; padding: 12px; background: #f8fafc; border-left: 4px solid #0f766e; font-size: 14px; }
  footer { margin-top: 28px; font-size: 12px; color: #64748b; }
  @media print { body { margin: 16mm; } }
</style>
</head>
<body>
<header>
  <p class="brand">${escapeHtml(clubName)}</p>
  <h1>Statement of account</h1>
</header>
<dl class="meta">
  <div><dt>Player</dt><dd>${escapeHtml(player.name)}</dd></div>
  <div><dt>Guardian</dt><dd>${escapeHtml(guardian || "Not recorded")}</dd></div>
  <div><dt>Team</dt><dd>${escapeHtml(teamLabel)}</dd></div>
  <div><dt>Statement date</dt><dd>${escapeHtml(formatDay(todayIso()))}</dd></div>
</dl>
<table>
  <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="2">${escapeHtml(balanceLabel)}</td><td class="num">${escapeHtml(balanceAmount)}</td></tr>
  </tbody>
</table>
<p class="note">${escapeHtml(statementBalanceLine(player))}</p>
<footer>${escapeHtml(clubName)} · Statement generated ${escapeHtml(formatDay(todayIso()))}. Please contact the club if you have any questions.</footer>
</body>
</html>`;
}

function escapeHtml(value: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
