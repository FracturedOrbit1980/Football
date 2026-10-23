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
import type { ChaseStage, ChaseState } from "@/lib/club/credit";
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

function payHtml(player: ClubPlayer, context: StatementContext) {
  if (context.paymentLines.length === 0) return "";
  return `<div class="pay"><h2>How to pay</h2>${context.paymentLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}${player.regNumber ? `<p class="ref">Reference: ${escapeHtml(player.regNumber)}</p>` : ""}</div>`;
}

function sheetHtml(player: ClubPlayer, context: StatementContext) {
  const balanceLabel = creditOf(player) > 0 ? "In credit" : "Outstanding";
  const balanceAmount = creditOf(player) > 0 ? rand(creditOf(player)) : rand(outstandingOf(player));
  const payBlock = payHtml(player, context);
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
  .letter p { font-size: 14px; margin: 0 0 12px; }
  .letter .salutation { margin: 0 0 16px; }
  .letter .meta { margin-bottom: 16px; }
  .amount { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 0 0 16px; padding: 12px 16px; background: #f1f5f9; border-left: 4px solid #0f766e; }
  .amount span { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
  .amount strong { font-size: 22px; font-variant-numeric: tabular-nums; }
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

const REMINDER_TITLES: Record<ChaseStage, string> = {
  Reminder: "Payment reminder",
  "Second reminder": "Second reminder",
  "Final demand": "Final demand",
  Handover: "Final notice before handover",
};

const REMINDER_CLOSINGS: Record<ChaseStage, string> = {
  Reminder:
    "If you have already paid, please ignore this letter. Otherwise, pay the amount shown above or contact the club to arrange a payment plan.",
  "Second reminder":
    "If you have already paid, please ignore this letter. Otherwise, pay the amount shown above or contact the club to arrange a payment plan.",
  "Final demand": "Please pay within 7 days, or contact the club at once to arrange a payment plan.",
  Handover: "Please contact the club within 7 days to settle the account or agree a payment plan.",
};

export function reminderTitle(stage: ChaseStage) {
  return REMINDER_TITLES[stage];
}

function reminderOpening(player: ClubPlayer, state: ChaseState) {
  switch (state.stage) {
    case "Reminder":
      return `Our records show that ${rand(state.outstanding)} is still outstanding on the season registration fee for ${player.name}. This is a friendly reminder.`;
    case "Second reminder":
      return `We have not yet received the ${rand(state.outstanding)} outstanding on the season registration fee for ${player.name}.`;
    case "Final demand":
      return `Despite earlier reminders, ${rand(state.outstanding)} remains outstanding on the season registration fee for ${player.name}.`;
    default:
      return `Despite earlier reminders, ${rand(state.outstanding)} remains outstanding on the season registration fee for ${player.name}. Unless it is settled or an arrangement is agreed, the club will hand this account over for collection.`;
  }
}

function reminderSheetHtml(player: ClubPlayer, context: StatementContext, state: ChaseState) {
  return `<section class="sheet letter">
<header>
  <p class="brand">${escapeHtml(context.clubName)}</p>
  <h1>${escapeHtml(reminderTitle(state.stage))}</h1>
</header>
<p class="salutation">Dear ${escapeHtml(context.guardian || player.guardianName || "Parent or guardian")},</p>
<p>${escapeHtml(reminderOpening(player, state))}</p>
<div class="amount"><span>Outstanding</span><strong>${escapeHtml(rand(state.outstanding))}</strong></div>
<dl class="meta">
  <div><dt>Player</dt><dd>${escapeHtml(player.name)}</dd></div>
  <div><dt>Registration</dt><dd>${escapeHtml(player.regNumber || "—")}</dd></div>
  <div><dt>Team</dt><dd>${escapeHtml(context.teamLabel)}</dd></div>
  ${player.feeDueDate ? `<div><dt>Fee due</dt><dd>${escapeHtml(formatDay(player.feeDueDate))}</dd></div>` : ""}
</dl>
${agreementHtml(player)}
${payHtml(player, context)}
<p class="note">${escapeHtml(statementBalanceLine(player))}</p>
<p>${escapeHtml(REMINDER_CLOSINGS[state.stage])}</p>
<footer>${escapeHtml(context.clubName)} · ${escapeHtml(formatDay(todayIso()))}. Please contact the club if you have any questions about this account.</footer>
</section>`;
}

export interface ReminderEntry {
  player: ClubPlayer;
  context: StatementContext;
  state: ChaseState;
}

export function printReminder(player: ClubPlayer, context: StatementContext, state: ChaseState) {
  const title = `${reminderTitle(state.stage)} — ${player.name}`;
  return openAndPrint(documentHtml(title, reminderSheetHtml(player, context, state)));
}

export function printReminders(entries: ReminderEntry[], clubName: string) {
  if (entries.length === 0) return false;
  const total = entries.reduce((sum, entry) => sum + entry.state.outstanding, 0);
  const batch = `<div class="batch"><h2>Reminder run</h2><p>${entries.length} ${entries.length === 1 ? "letter" : "letters"} generated ${escapeHtml(formatDay(todayIso()))} · ${escapeHtml(clubName)} · total outstanding ${escapeHtml(rand(total))}.</p></div>`;
  const sheets = entries.map((entry) => reminderSheetHtml(entry.player, entry.context, entry.state)).join("");
  return openAndPrint(documentHtml(`Reminders — ${clubName}`, `${batch}${sheets}`));
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
