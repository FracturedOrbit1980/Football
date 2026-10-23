"use client";

import { useState } from "react";

import { PlayerPortrait } from "@/components/club/player-photo";
import { Button } from "@/components/ui/button";
import { ageAnalysis, bucketOf, chargedOf, creditOf, daysOverdue, isIsoDate, outstandingOf, paidTotal, rand, sponsorCreditOf, todayIso, AGE_BUCKETS, type AgeBucket } from "@/lib/club/accounting";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { planProgress, promiseStatus } from "@/lib/club/agreements";
import { chaseState, creditSummary, daysSince, lastContact } from "@/lib/club/credit";
import { paymentDetailsLines } from "@/lib/club/registry";
import { searchPlayers } from "@/lib/club/registration";
import type { ClubPlayer } from "@/lib/club/seed";
import { printReminder, printReminders, printStatement, reminderTitle, statementBalanceLine, statementMailto, type ReminderEntry, type StatementContext } from "@/lib/club/statement";
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
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const club = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const clubName = club?.name ?? "Clubstride";
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<AgeBucket | "">("");
  const [chaseOnly, setChaseOnly] = useState(false);
  const [reminderNotice, setReminderNotice] = useState("");
  const [reminderError, setReminderError] = useState("");
  const teams = ageGroups.flatMap((group) =>
    group.teams.map((team) => ({ ...team, label: `${ageLabel(group.name)} · ${team.division ?? team.name}` })),
  );
  const labelOf = (player: ClubPlayer) =>
    teams.find((team) => team.id === player.teamId)?.label ?? "Not on a team yet";
  const filterLabel =
    filter === "none"
      ? "players not on a team"
      : filter
        ? teams.find((team) => team.id === filter)?.label ?? "this team"
        : "the whole club";
  const scoped = searchPlayers(players, query, labelOf)
    .filter((player) => (filter === "" ? true : filter === "none" ? !player.teamId : player.teamId === filter))
    .slice()
    .sort((a, b) => a.squadNumber - b.squadNumber || a.name.localeCompare(b.name));
  const chaseStates = new Map(scoped.map((player) => [player.id, chaseState(player)]));
  const chaseIds = new Set(
    scoped.filter((player) => {
      const state = chaseStates.get(player.id);
      return Boolean(state && !state.hold);
    }).map((player) => player.id),
  );
  const matched = bucket
    ? scoped.filter((player) => outstandingOf(player) > 0 && bucketOf(daysOverdue(player)) === bucket)
    : scoped;
  const visible = matched.filter((player) => (chaseOnly ? chaseIds.has(player.id) : true));
  if (chaseOnly) visible.sort((a, b) => (chaseStates.get(b.id)?.days ?? 0) - (chaseStates.get(a.id)?.days ?? 0));
  const totals = scoped.reduce(
    (sum, player) => ({
      billed: sum.billed + player.seasonFee,
      sponsored: sum.sponsored + sponsorCreditOf(player),
      received: sum.received + paidTotal(player),
      outstanding: sum.outstanding + outstandingOf(player),
    }),
    { billed: 0, sponsored: 0, received: 0, outstanding: 0 },
  );
  const awaiting = scoped.filter((player) => player.seasonFee > 0 && outstandingOf(player) > 0).length;
  const ageing = ageAnalysis(scoped);
  const paymentLines = club ? paymentDetailsLines(club) : [];
  const credit = creditSummary(scoped);
  const reminderEntries: ReminderEntry[] = visible.flatMap((player) => {
    const state = chaseStates.get(player.id);
    if (!state || state.hold) return [];
    return [
      {
        player,
        state,
        context: { clubName, teamLabel: labelOf(player), guardian: player.guardianName, paymentLines },
      },
    ];
  });

  function remindAll() {
    if (reminderEntries.length === 0) return;
    if (!printReminders(reminderEntries, clubName)) {
      setReminderError("Allow pop-ups to print the reminders.");
      setReminderNotice("");
      return;
    }
    for (const entry of reminderEntries) {
      addCorrespondence(
        entry.player.id,
        "Print",
        `${reminderTitle(entry.state.stage)} printed for ${entry.player.guardianName || "the guardian"}.`,
      );
    }
    setReminderNotice(
      `${reminderEntries.length} ${reminderEntries.length === 1 ? "reminder" : "reminders"} printed and added to correspondence.`,
    );
    setReminderError("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">
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
          <label className="block text-sm font-semibold text-slate-800">
            Search accounts
            <input
              type="search"
              value={query}
              data-field="accounting-search"
              placeholder="Name, surname, ID, REG, mobile or guardian"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600">
          Each account lists its balance and ageing. Use Record payment to capture money received, Fee to set the season
          fee, due date and guardian, Statement to preview, print or email it, and Remind to print the next chase letter.
          Club sponsorship is credited against the fee, so outstanding is the fee less sponsorship less what was paid.
          Totals and the age analysis below cover {filterLabel}
          {query.trim() ? ` matching "${query.trim()}"` : ""}.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Accounting totals">
        <Total label="Season fees" value={rand(totals.billed)} />
        <Total label="Received" value={rand(totals.received)} />
        <Total label="Outstanding" value={rand(totals.outstanding)} emphasis />
        <Total label="Accounts awaiting" value={String(awaiting)} />
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300" aria-label="Credit control" data-credit-control>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Credit control</h2>
            <p className="mt-1 text-sm font-medium text-slate-700" data-credit-summary>
              <span className="font-black text-slate-950">{credit.chase}</span>{" "}
              {credit.chase === 1 ? "account" : "accounts"} to chase
              {credit.held > 0 ? (
                <>
                  {" · "}
                  <span className="font-black text-slate-950">{credit.held}</span> on hold
                </>
              ) : null}
              {credit.broken > 0 ? (
                <>
                  {" · "}
                  <span className="font-bold text-rose-800">
                    {credit.broken} {credit.broken === 1 ? "arrangement" : "arrangements"} broken
                  </span>
                </>
              ) : null}
              {credit.oldest > 0 ? (
                <>
                  {" · "}oldest {credit.oldest} {credit.oldest === 1 ? "day" : "days"}
                </>
              ) : null}
              {credit.overdue > 0 ? <>{" · "}{rand(credit.overdue)} overdue</> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              aria-pressed={chaseOnly}
              data-chase-filter
              onClick={() => setChaseOnly(!chaseOnly)}
              className={`h-11 ${chaseOnly ? "ring-2 ring-emerald-600" : ""}`}
            >
              {chaseOnly ? "Show all accounts" : `Only accounts to chase${credit.chase > 0 ? ` (${credit.chase})` : ""}`}
            </Button>
            {reminderEntries.length > 0 ? (
              <Button type="button" size="lg" data-remind-all onClick={remindAll} className="h-11">
                Remind all ({reminderEntries.length})
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Reminders follow the age buckets: a reminder up to 30 days, a second reminder to 60, a final demand to 90, then
          handover. An open promise to pay or an agreement on track pauses chasing.
        </p>
        {reminderNotice ? <p className="mt-2 text-sm font-semibold text-emerald-800" data-remind-notice>{reminderNotice}</p> : null}
        {reminderError ? <p className="mt-2 text-sm font-semibold text-rose-700" data-remind-error>{reminderError}</p> : null}
      </section>

      <section aria-label="Age analysis">
        <h2 className="text-lg font-bold text-slate-950">Age analysis</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Outstanding money by how long it is past its due date. Choose a bucket to filter the accounts below, then use
          the search box to find a guardian, ID, registration reference or mobile number.
        </p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" data-age-analysis>
          {AGE_BUCKETS.map((item) => {
            const selected = bucket === item;
            return (
              <li key={item}>
                <button
                  type="button"
                  data-age-bucket={item}
                  aria-pressed={selected}
                  onClick={() => setBucket(selected ? "" : item)}
                  className={`w-full rounded-xl bg-white p-4 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "ring-2 ring-emerald-600" : "ring-slate-300 hover:ring-emerald-600"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{item}</span>
                  <span className="mt-1 block text-xl font-black tabular-nums text-slate-950">{rand(ageing[item].amount)}</span>
                  <span className="block text-xs font-semibold text-slate-600">
                    {ageing[item].count} {ageing[item].count === 1 ? "account" : "accounts"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {bucket || totals.sponsored > 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-700" data-age-analysis-note>
            {bucket ? `Filtered to ${bucket}. ` : ""}
            {totals.sponsored > 0 ? `Club sponsorship covers ${rand(totals.sponsored)} of these fees. ` : ""}
            {bucket ? (
              <button type="button" data-clear-bucket onClick={() => setBucket("")} className="font-bold text-emerald-700 underline">
                Show every account
              </button>
            ) : null}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-950">
          Player accounts
          <span className="ml-2 text-sm font-semibold text-slate-500">{visible.length}</span>
        </h2>
        {visible.length === 0 ? (
          <p className="mt-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">
            {bucket || query.trim() || chaseOnly
              ? chaseOnly && !bucket && !query.trim()
                ? "Nothing to chase. Accounts with an open promise or an agreement on track are on hold."
                : "No account matches this filter. Clear the search or choose another bucket."
              : "No players match this filter. Register players on People, then set their fee here."}
          </p>
        ) : (
          <ul className="mt-2 space-y-3" data-accounting-list>
            {visible.map((player) => (
              <AccountRow
                key={player.id}
                player={player}
                clubName={clubName}
                teamLabel={labelOf(player)}
                paymentLines={paymentLines}
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

function AccountRow({
  player,
  clubName,
  teamLabel,
  paymentLines,
}: {
  player: ClubPlayer;
  clubName: string;
  teamLabel: string;
  paymentLines: string[];
}) {
  const setPlayerAccount = useClubStore((state) => state.setPlayerAccount);
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const [fee, setFee] = useState(String(player.seasonFee));
  const [dueDate, setDueDate] = useState(player.feeDueDate);
  const [guardianName, setGuardianName] = useState(player.guardianName);
  const [guardianEmail, setGuardianEmail] = useState(player.guardianEmail);
  const [panel, setPanel] = useState<"" | "fee" | "statement">("");
  const [focusPayment, setFocusPayment] = useState(false);
  const [saved, setSaved] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
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
  const sponsored = sponsorCreditOf(player);
  const progress = planProgress(player);
  const promised = promiseStatus(player);
  const chase = chaseState(player);
  const contact = lastContact(player);
  const daysAgo = contact ? daysSince(contact.date) : null;
  const context: StatementContext = {
    clubName,
    teamLabel,
    guardian: guardianName || player.guardianName,
    paymentLines,
  };
  const mailto = statementMailto(player, context);

  function openPanel(next: "" | "fee" | "statement", payment = false) {
    setPanel(next);
    setFocusPayment(next === "statement" && payment);
    setNotice("");
    setError("");
  }

  function printQuick() {
    if (printStatement(player, context)) {
      addCorrespondence(player.id, "Print", `Statement printed for ${guardianName || player.guardianName || "the guardian"}.`);
      setNotice("Statement printed and added to correspondence.");
      setError("");
    } else {
      setError("Allow pop-ups to print the statement.");
      setNotice("");
    }
  }

  function printChase() {
    if (!chase) return;
    const title = reminderTitle(chase.stage);
    if (printReminder(player, context, chase)) {
      addCorrespondence(player.id, "Print", `${title} printed for ${guardianName || player.guardianName || "the guardian"}.`);
      setNotice(`${title} printed and added to correspondence.`);
      setError("");
    } else {
      setError("Allow pop-ups to print the reminder.");
      setNotice("");
    }
  }

  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-account={player.name}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-950">
              {player.squadNumber} {player.name}
            </p>
            <p className="text-sm font-medium text-slate-600">
              {player.regNumber} · {teamLabel}
            </p>
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

      {sponsored > 0 ? (
        <p className="mt-1 text-sm font-semibold text-emerald-800" data-account-sponsorship>
          Club sponsorship covers {rand(sponsored)} · the family is billed {rand(chargedOf(preview))}.
        </p>
      ) : null}

      {progress || player.promise ? (
        <p className="mt-1 text-sm font-semibold text-slate-700" data-account-arrangement>
          {progress
            ? `Payment agreement: ${progress.settled} of ${progress.rows.length} instalments paid · ${progress.status}.`
            : ""}
          {progress && player.promise ? " " : ""}
          {player.promise
            ? `Promise to pay ${rand(player.promise.amount)} by ${formatDay(player.promise.date)} (${promised}).`
            : ""}
        </p>
      ) : null}

      {chase ? (
        <p className="mt-1 text-sm" data-account-chase>
          {chase.hold ? (
            <span className="font-semibold text-slate-700">
              Chasing paused · {chase.hold === "Promise" ? "promise to pay open" : "agreement on track"}.
            </span>
          ) : (
            <span className="font-semibold text-amber-900">Next step: {chase.stage}.</span>
          )}{" "}
          <span className="font-medium text-slate-600">
            {contact && daysAgo !== null
              ? `Last contact ${daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`} (${contact.channel}).`
              : "No contact logged yet."}
          </span>
        </p>
      ) : null}

      <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm" data-account-money>
        <div className="flex items-baseline gap-2">
          <dt className="font-semibold text-slate-600">Billed</dt>
          <dd className="tabular-nums font-black text-slate-950">{rand(chargedOf(preview))}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-semibold text-slate-600">Received</dt>
          <dd className="tabular-nums font-black text-slate-950">{rand(paid)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-semibold text-slate-600">Outstanding</dt>
          <dd className="tabular-nums font-black text-slate-950">{rand(outstanding)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2" data-account-quick>
        <Button type="button" size="lg" className="h-11" onClick={() => openPanel("statement", true)}>
          Record payment
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11"
          aria-expanded={panel === "fee"}
          onClick={() => openPanel(panel === "fee" ? "" : "fee")}
        >
          {feeValue > 0 ? "Fee and guardian" : "Set fee"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11"
          aria-expanded={panel === "statement"}
          onClick={() => openPanel(panel === "statement" ? "" : "statement")}
        >
          {panel === "statement" ? "Close statement" : "Statement"}
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-11" onClick={printQuick}>
          Print
        </Button>
        {chase && !chase.hold ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11"
            data-field={`remind-${player.id}`}
            onClick={printChase}
          >
            Remind
          </Button>
        ) : null}
        {mailto ? (
          <Button asChild size="lg" variant="outline" className="h-11">
            <a
              href={mailto}
              data-field={`quick-email-${player.id}`}
              onClick={() => {
                addCorrespondence(player.id, "Email", `Statement opened in the mail app for ${player.guardianEmail}.`);
                setNotice("Mail app opened and the statement added to correspondence.");
                setError("");
              }}
            >
              Email
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11"
            onClick={() => {
              openPanel("fee");
              setError("Add the guardian's email, then save it to send a statement.");
            }}
          >
            Email
          </Button>
        )}
      </div>

      {notice ? <p className="mt-2 text-sm font-semibold text-emerald-800" data-account-notice>{notice}</p> : null}
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700" data-account-error>{error}</p> : null}

      {panel === "fee" ? (
        <>
          <form
            className="mt-3 grid items-end gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
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
            <Button type="submit" size="lg" className="h-11 sm:col-span-2 lg:col-span-1">
              Save
            </Button>
          </form>
          {saved ? <p className="mt-2 text-sm font-semibold text-emerald-800">{saved}</p> : null}
        </>
      ) : null}

      {panel === "statement" ? (
        <StatementPanel
          player={player}
          clubName={clubName}
          teamLabel={teamLabel}
          guardianName={guardianName}
          paymentLines={paymentLines}
          focusPayment={focusPayment}
        />
      ) : null}
    </li>
  );
}

function StatementPanel({
  player,
  clubName,
  teamLabel,
  guardianName,
  paymentLines,
  focusPayment,
}: {
  player: ClubPlayer;
  clubName: string;
  teamLabel: string;
  guardianName: string;
  paymentLines: string[];
  focusPayment: boolean;
}) {
  const recordPayment = useClubStore((state) => state.recordPayment);
  const removePayment = useClubStore((state) => state.removePayment);
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmPayment, setConfirmPayment] = useState("");
  const paid = paidTotal(player);
  const outstanding = outstandingOf(player);
  const credit = creditOf(player);
  const sponsored = sponsorCreditOf(player);
  const payments = [...player.payments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const context: StatementContext = {
    clubName,
    teamLabel,
    guardian: guardianName || player.guardianName,
    paymentLines,
  };
  const balanceLine = statementBalanceLine(player);
  const mailto = statementMailto(player, context);
  const progress = planProgress(player);
  const promised = promiseStatus(player);

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
              autoFocus={focusPayment}
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
          {sponsored > 0 ? (
            <>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="font-medium text-emerald-800">Club sponsorship</dt>
                <dd className="tabular-nums font-bold text-emerald-800">− {rand(sponsored)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="font-medium text-slate-700">Billed to the family</dt>
                <dd className="tabular-nums font-bold text-slate-950">{rand(chargedOf(player))}</dd>
              </div>
            </>
          ) : null}
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
        {progress || player.promise ? (
          <div className="mt-2 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-300" data-statement-arrangement>
            <p className="font-bold text-slate-900">Payment arrangement</p>
            {progress ? (
              <>
                <p className="text-slate-700">
                  {progress.rows.length} {progress.rows.length === 1 ? "instalment" : "instalments"} totalling{" "}
                  {rand(progress.total)} · {progress.settled} paid · {progress.status}.
                </p>
                {progress.next ? (
                  <p className="text-slate-700">
                    Next: {rand(progress.next.amount)} due {formatDay(progress.next.dueDate)}.
                  </p>
                ) : null}
              </>
            ) : null}
            {player.promise ? (
              <p className="text-slate-700">
                Promise to pay {rand(player.promise.amount)} by {formatDay(player.promise.date)} ({promised}).
              </p>
            ) : null}
            <p className="mt-1 text-xs font-medium text-slate-600">Set up or change agreements and promises on Members.</p>
          </div>
        ) : null}
        {paymentLines.length > 0 ? (
          <div className="mt-2 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-300" data-statement-pay>
            <p className="font-bold text-slate-900">How to pay</p>
            {paymentLines.map((line) => (
              <p key={line} className="text-slate-700">
                {line}
              </p>
            ))}
            {player.regNumber ? <p className="font-semibold text-slate-900">Reference: {player.regNumber}</p> : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="h-11"
            onClick={() => {
              const printed = printStatement(player, context);
              if (printed) {
                addCorrespondence(player.id, "Print", `Statement printed for ${guardianName || player.guardianName || "the guardian"}.`);
                setNotice("Statement printed and added to correspondence.");
              } else {
                setError("Allow pop-ups to print the statement.");
              }
            }}
          >
            Print statement
          </Button>
          {mailto ? (
            <Button asChild size="lg" variant="outline" className="h-11">
              <a
                href={mailto}
                data-field="email-guardian"
                onClick={() => {
                  addCorrespondence(player.id, "Email", `Statement opened in the mail app for ${player.guardianEmail}.`);
                  setNotice("Mail app opened and the statement added to correspondence.");
                }}
              >
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
