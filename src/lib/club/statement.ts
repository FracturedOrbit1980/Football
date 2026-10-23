import {
  bucketOf,
  chargedOf,
  creditOf,
  daysOverdue,
  isIsoDate,
  outstandingOf,
  paidTotal,
  rand,
  sponsorCreditOf,
  todayIso,
} from "@/lib/club/accounting";
import { planProgress, promiseStatus } from "@/lib/club/agreements";
import type { ClubPlayer, PaymentRecord } from "@/lib/club/seed";
import { formatDay } from "@/lib/club/week";

export interface StatementContext {
  clubName: string;
  teamLabel: string;
  guardian: string;
  paymentLines: string[];
}

export interface StatementEntry {
  player: ClubPlayer;
  context: StatementContext;
}

export function statementBalanceLine(player: ClubPlayer) {
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

export function agreementLines(player: ClubPlayer): string[] {
  const lines: string[] = [];
  const progress = planProgress(player);
  if (progress) {
    lines.push(
      `Payment agreement: ${progress.rows.length} ${progress.rows.length === 1 ? "instalment" : "instalments"} covering ${rand(progress.total)} agreed on ${formatDay(player.paymentPlan?.agreedOn ?? todayIso())} (${progress.status}).`,
    );
    lines.push(`Paid against the agreement: ${rand(progress.paid)}. Still to pay: ${rand(progress.remaining)}.`);
    if (progress.next) {
      lines.push(`Next instalment: ${rand(progress.next.amount)} due ${formatDay(progress.next.dueDate)}.`);
    }
  }
  const status = promiseStatus(player);
  if (player.promise && status) {
    lines.push(
      `Promise to pay: ${rand(player.promise.amount)} by ${formatDay(player.promise.date)} (${status}).`,
    );
  }
  return lines;
}

export function statementSubject(player: ClubPlayer) {
  return `Statement of account — ${player.name}`;
}

export function statementText(player: ClubPlayer, context: StatementContext) {
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date));
  const sponsored = sponsorCreditOf(player);
  const agreements = agreementLines(player);
  const lines = [
    context.clubName,
    statementSubject(player),
    "",
    `Registration: ${player.regNumber}`,
    `Guardian: ${context.guardian || player.guardianName || "Not recorded"}`,
    `Team: ${context.teamLabel}`,
    `Statement date: ${formatDay(todayIso())}`,
    "",
    player.feeDueDate
      ? `Season registration fee (due ${formatDay(player.feeDueDate)}): ${rand(player.seasonFee)}`
      : `Season registration fee: ${rand(player.seasonFee)}`,
    ...(sponsored > 0 ? [`Club sponsorship credited: -${rand(sponsored)}`, `Amount charged to the family: ${rand(chargedOf(player))}`] : []),
    "",
    payments.length ? "Payments received:" : "No payments received.",
    ...payments.map((payment) => `  ${formatDay(payment.date)}: ${rand(payment.amount)}`),
    "",
    `Total received: ${rand(paidTotal(player))}`,
    `Balance outstanding: ${rand(outstandingOf(player))}`,
    statementBalanceLine(player),
    ...(agreements.length ? ["", ...agreements] : []),
    "",
    ...(context.paymentLines.length
      ? [
          "How to pay:",
          ...context.paymentLines.map((line) => `  ${line}`),
          ...(player.regNumber ? [`  Reference: ${player.regNumber}`] : []),
          "",
        ]
      : []),
    "Please contact the club if you have any questions about this statement.",
  ];
  return lines.join("\n");
}

export function statementMailto(player: ClubPlayer, context: StatementContext) {
  if (!player.guardianEmail) return "";
  return `mailto:${player.guardianEmail}?subject=${encodeURIComponent(statementSubject(player))}&body=${encodeURIComponent(statementText(player, context))}`;
}

function rowsHtml(player: ClubPlayer) {
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date));
  const sponsored = sponsorCreditOf(player);
  return [
    `<tr><td>${player.feeDueDate ? escapeHtml(formatDay(player.feeDueDate)) : "—"}</td><td>Season registration fee</td><td class="num">${escapeHtml(rand(player.seasonFee))}</td></tr>`,
    ...(sponsored > 0
      ? [`<tr><td>—</td><td>Club sponsorship credited</td><td class="num">− ${escapeHtml(rand(sponsored))}</td></tr>`]
      : []),
    ...payments.map(
      (payment: PaymentRecord) =>
        `<tr><td>${escapeHtml(formatDay(payment.date))}</td><td>Payment received</td><td class="num">− ${escapeHtml(rand(payment.amount))}</td></tr>`,
    ),
  ].join("");
}

function agreementHtml(player: ClubPlayer) {
  const lines = agreementLines(player);
  if (lines.length === 0) return "";
  return `<div class="agreement"><h2>Payment arrangement</h2>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
}

function sheetHtml(player: ClubPlayer, context: StatementContext) {
  const balanceLabel = creditOf(player) > 0 ? "In credit" : "Outstanding";
  const balanceAmount = creditOf(player) > 0 ? rand(creditOf(player)) : rand(outstandingOf(player));
  const payBlock =
    context.paymentLines.length > 0
      ? `<div class="pay"><h2>How to pay</h2>${context.paymentLines
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}${player.regNumber ? `<p class="ref">Reference: ${escapeHtml(player.regNumber)}</p>` : ""}</div>`
      : "";
  return `<section class="sheet">
<header>
  <p class="brand">${escapeHtml(context.clubName)}</p>
  <h1>Statement of account</h1>
</header>
<dl class="meta">
  <div><dt>Player</dt><dd>${escapeHtml(player.name)}</dd></div>
  <div><dt>Registration</dt><dd>${escapeHtml(player.regNumber || "—")}</dd></div>
  <div><dt>Guardian</dt><dd>${escapeHtml(context.guardian || player.guardianName || "Not recorded")}</dd></div>
  <div><dt>Team</dt><dd>${escapeHtml(context.teamLabel)}</dd></div>
  <div><dt>Statement date</dt><dd>${escapeHtml(formatDay(todayIso()))}</dd></div>
</dl>
<table>
  <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead>
  <tbody>
    ${rowsHtml(player)}
    <tr class="total"><td colspan="2">${escapeHtml(balanceLabel)}</td><td class="num">${escapeHtml(balanceAmount)}</td></tr>
  </tbody>
</table>
${agreementHtml(player)}
${payBlock}
<p class="note">${escapeHtml(statementBalanceLine(player))}</p>
<footer>${escapeHtml(context.clubName)} · Statement generated ${escapeHtml(formatDay(todayIso()))}. Please contact the club if you have any questions.</footer>
</section>`;
}

const STYLES = `
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0b1b33; margin: 32px; line-height: 1.45; }
  .sheet { margin-bottom: 8px; }
  header { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 24px; }
  .brand { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; font-weight: 700; }
  h1 { font-size: 24px; margin: 6px 0 0; }
  .batch { margin-bottom: 24px; padding: 12px; background: #f1f5f9; border-left: 4px solid #0b1b33; font-size: 14px; }
  .batch h2, .pay h2, .agreement h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 6px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 0 0 24px; font-size: 14px; }
  .meta dt { color: #475569; font-weight: 600; margin: 0; }
  .meta dd { margin: 0 0 8px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
  th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total td { border-top: 2px solid #0b1b33; border-bottom: none; font-weight: 800; font-size: 15px; }
  .note { margin-top: 20px; padding: 12px; background: #f8fafc; border-left: 4px solid #0f766e; font-size: 14px; }
  .pay, .agreement { margin-top: 20px; padding: 12px; background: #f1f5f9; border-left: 4px solid #0b1b33; font-size: 14px; }
  .pay p, .agreement p { margin: 2px 0; }
  .pay .ref { margin-top: 8px; font-weight: 800; }
  footer { margin-top: 28px; font-size: 12px; color: #64748b; }
  @media print { body { margin: 16mm; } .sheet { page-break-after: always; } .sheet:last-of-type { page-break-after: auto; } }
`;

function documentHtml(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function printStatement(player: ClubPlayer, context: StatementContext) {
  return openAndPrint(documentHtml(`Statement — ${player.name}`, sheetHtml(player, context)));
}

export function printStatementBundle(entries: StatementEntry[], clubName: string) {
  if (entries.length === 0) return false;
  const outstanding = entries.reduce((sum, entry) => sum + outstandingOf(entry.player), 0);
  const batch = `<div class="batch"><h2>Statement batch</h2><p>${entries.length} ${entries.length === 1 ? "statement" : "statements"} generated ${escapeHtml(formatDay(todayIso()))} · ${escapeHtml(clubName)} · total outstanding ${escapeHtml(rand(outstanding))}.</p></div>`;
  const sheets = entries.map((entry) => sheetHtml(entry.player, entry.context)).join("");
  return openAndPrint(documentHtml(`Statements — ${clubName}`, `${batch}${sheets}`));
}

function openAndPrint(html: string) {
  const win = window.open("", "_blank", "width=760,height=900");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
  return true;
}

function escapeHtml(value: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
