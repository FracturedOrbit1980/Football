"use client";

import { useState } from "react";

import { PlayerPortrait } from "@/components/club/player-photo";
import { Button } from "@/components/ui/button";
import {
  AGE_BUCKETS,
  bucketOf,
  chargedOf,
  daysOverdue,
  outstandingOf,
  paidTotal,
  rand,
  sponsorCreditOf,
  todayIso,
  type AgeBucket,
} from "@/lib/club/accounting";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import { buildPlan, planProgress, promiseStatus, PLAN_FREQUENCIES, type PlanFrequency } from "@/lib/club/agreements";
import { paymentDetailsLines } from "@/lib/club/registry";
import { searchPlayers } from "@/lib/club/registration";
import type { ClubPlayer } from "@/lib/club/seed";
import {
  printStatement,
  printStatementBundle,
  statementMailto,
  type StatementContext,
  type StatementEntry,
} from "@/lib/club/statement";
import { formatDay } from "@/lib/club/week";
import { useClubStore } from "@/stores/club-store";
import { activeClub, useClubLibrary } from "@/stores/club-library";

const STATUS_FILTERS = [
  { id: "", label: "Every member" },
  { id: "outstanding", label: "Outstanding balance" },
  { id: "settled", label: "Settled accounts" },
  { id: "sponsored", label: "Sponsored by the club" },
  { id: "agreement", label: "Payment agreement" },
  { id: "promise", label: "Promise to pay" },
  { id: "missed", label: "Missed instalment or overdue promise" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

function matchesStatus(player: ClubPlayer, status: StatusFilter) {
  switch (status) {
    case "outstanding":
      return outstandingOf(player) > 0;
    case "settled":
      return chargedOf(player) > 0 && outstandingOf(player) === 0;
    case "sponsored":
      return sponsorCreditOf(player) > 0;
    case "agreement":
      return Boolean(player.paymentPlan);
    case "promise":
      return Boolean(player.promise);
    case "missed":
      return (planProgress(player)?.missed ?? 0) > 0 || promiseStatus(player) === "Overdue";
    default:
      return true;
  }
}

export function MembersBoard() {
  const players = useClubStore((state) => state.players);
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const ageGroups = ensureYouthAges(useClubStore((state) => state.ageGroups));
  const club = activeClub(
    useClubLibrary((state) => state.clubs),
    useClubLibrary((state) => state.activeId),
  );
  const clubName = club?.name ?? "Clubstride";
  const paymentLines = club ? paymentDetailsLines(club) : [];
  const teams = ageGroups.flatMap((group) =>
    group.teams.map((team) => ({ ...team, label: `${ageLabel(group.name)} · ${team.division ?? team.name}` })),
  );
  const labelOf = (player: ClubPlayer) =>
    teams.find((team) => team.id === player.teamId)?.label ?? "Not on a team yet";

  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("");
  const [bucket, setBucket] = useState<AgeBucket | "">("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [batchNotice, setBatchNotice] = useState("");
  const [batchError, setBatchError] = useState("");

  const visible = searchPlayers(players, query, labelOf)
    .filter((player) => (teamId === "" ? true : teamId === "none" ? !player.teamId : player.teamId === teamId))
    .filter((player) => matchesStatus(player, status))
    .filter((player) => (bucket ? outstandingOf(player) > 0 && bucketOf(daysOverdue(player)) === bucket : true));

  const contextOf = (player: ClubPlayer): StatementContext => ({
    clubName,
    teamLabel: labelOf(player),
    guardian: player.guardianName,
    paymentLines,
  });

  const selectedPlayers = visible.filter((player) => selected.includes(player.id));
  const selectedTotals = selectedPlayers.reduce(
    (sum, player) => ({ outstanding: sum.outstanding + outstandingOf(player), sponsored: sum.sponsored + sponsorCreditOf(player) }),
    { outstanding: 0, sponsored: 0 },
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setBatchNotice("");
    setBatchError("");
  }

  function printBatch() {
    if (selectedPlayers.length === 0) {
      setBatchError("Select at least one member to print statements for.");
      return;
    }
    const entries: StatementEntry[] = selectedPlayers.map((player) => ({ player, context: contextOf(player) }));
    if (printStatementBundle(entries, clubName)) {
      for (const player of selectedPlayers) {
        addCorrespondence(
          player.id,
          "Print",
          `Statement printed in a batch of ${selectedPlayers.length} on ${formatDay(todayIso())}.`,
        );
      }
      setQueueOpen(false);
      setBatchNotice(`Printed ${selectedPlayers.length} ${selectedPlayers.length === 1 ? "statement" : "statements"} and logged them to correspondence.`);
      setBatchError("");
    } else {
      setBatchError("Allow pop-ups so the statement batch can open in a print window.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300">
        <h2 className="text-lg font-bold text-slate-950">Find members</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Search by first name, surname, ID number, club registration reference, mobile number, guardian name or email,
          and the player&apos;s squad details. Then narrow by team, ageing bucket or account status.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block text-sm font-semibold text-slate-800">
            Search members
            <input
              type="search"
              value={query}
              data-field="member-search"
              placeholder="Surname, ID, REG-0001, mobile or guardian"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Team
            <select
              value={teamId}
              data-field="member-team"
              onChange={(event) => setTeamId(event.target.value)}
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
            Account status
            <select
              value={status}
              data-field="member-status"
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base"
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" data-ageing-filters>
          <button
            type="button"
            data-bucket="all"
            aria-pressed={bucket === ""}
            onClick={() => setBucket("")}
            className={`min-h-11 rounded-lg px-3 text-sm font-bold ${bucket === "" ? "btn-shade" : "btn-quiet"}`}
          >
            Every bucket
          </button>
          {AGE_BUCKETS.map((item) => (
            <button
              key={item}
              type="button"
              data-bucket={item}
              aria-pressed={bucket === item}
              onClick={() => setBucket(bucket === item ? "" : item)}
              className={`min-h-11 rounded-lg px-3 text-sm font-bold ${bucket === item ? "btn-shade" : "btn-quiet"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700" data-member-count>
          {visible.length} of {players.length} {players.length === 1 ? "member" : "members"} shown
          {selected.length > 0 ? ` · ${selectedPlayers.length} selected` : ""}.
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-batch-bar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="text-lg font-bold text-slate-950">Send statements in bulk</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Select members below, then print one statement per page, or work through the email queue in your mail app.
              {selectedPlayers.length > 0
                ? ` ${selectedPlayers.length} selected · outstanding ${rand(selectedTotals.outstanding)}${selectedTotals.sponsored > 0 ? ` · sponsorship ${rand(selectedTotals.sponsored)}` : ""}.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" variant="outline" className="h-11" data-field="select-visible" onClick={() => setSelected(visible.map((player) => player.id))}>
              Select all shown
            </Button>
            <Button type="button" size="lg" variant="outline" className="h-11" data-field="clear-selection" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button type="button" size="lg" className="h-11" data-field="print-batch" onClick={printBatch}>
              Print statements
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-11"
              data-field="email-queue"
              aria-expanded={queueOpen}
              onClick={() => {
                setQueueOpen((open) => !open);
                setBatchError("");
              }}
            >
              {queueOpen ? "Close email queue" : "Email queue"}
            </Button>
          </div>
        </div>
        {batchNotice ? <p className="mt-2 text-sm font-semibold text-emerald-800" data-batch-notice>{batchNotice}</p> : null}
        {batchError ? <p className="mt-2 text-sm font-semibold text-rose-700" data-batch-error>{batchError}</p> : null}
        {queueOpen ? (
          <EmailQueue
            players={selectedPlayers}
            contextOf={contextOf}
            addCorrespondence={addCorrespondence}
            onNotice={setBatchNotice}
            onError={setBatchError}
          />
        ) : null}
      </section>

      {visible.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300">
          {players.length === 0
            ? "No members registered yet. Add players on People, then their statements, agreements and sponsorship live here."
            : "No member matches those filters. Clear the search, or choose another bucket or status."}
        </p>
      ) : (
        <ul className="space-y-3" data-member-list>
          {visible.map((player) => (
            <MemberRow
              key={player.id}
              player={player}
              teamLabel={labelOf(player)}
              selected={selected.includes(player.id)}
              open={openId === player.id}
              context={contextOf(player)}
              onToggle={() => toggle(player.id)}
              onOpen={() => setOpenId(openId === player.id ? "" : player.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmailQueue({
  players,
  contextOf,
  addCorrespondence,
  onNotice,
  onError,
}: {
  players: ClubPlayer[];
  contextOf: (player: ClubPlayer) => StatementContext;
  addCorrespondence: (playerId: string, channel: "Email", summary: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  if (players.length === 0) {
    return (
      <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
        Select members first. The queue lists one ready-to-send statement per guardian.
      </p>
    );
  }
  const ready = players.filter((player) => player.guardianEmail);
  const missing = players.filter((player) => !player.guardianEmail);
  return (
    <div className="mt-3 space-y-3" data-email-queue>
      <p className="text-sm font-medium text-slate-600">
        Each link opens your mail app with the statement filled in. Nothing is sent automatically, and every send is
        logged to that member&apos;s correspondence.
      </p>
      {ready.length === 0 ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          None of the selected members has a guardian email. Add one on Accounting, or print the batch instead.
        </p>
      ) : (
        <ol className="space-y-2">
          {ready.map((player, index) => (
            <li key={player.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2" data-queue-item={player.regNumber}>
              <span className="text-sm font-black tabular-nums text-slate-500">{index + 1}</span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-sm font-bold text-slate-950">{player.name}</span>
                <span className="block truncate text-sm font-medium text-slate-600">
                  {player.guardianName || "Guardian not named"} · {player.guardianEmail}
                </span>
              </span>
              <span className="text-sm font-black tabular-nums text-slate-950">{rand(outstandingOf(player))}</span>
              <Button asChild size="lg" variant="outline" className="h-11">
                <a
                  href={statementMailto(player, contextOf(player))}
                  data-field={`queue-send-${player.id}`}
                  onClick={() => {
                    addCorrespondence(player.id, "Email", `Statement queued and opened in the mail app for ${player.guardianEmail}.`);
                    onNotice(`Opened the statement for ${player.name} and logged it to correspondence.`);
                    onError("");
                  }}
                >
                  Open in mail app
                </a>
              </Button>
            </li>
          ))}
        </ol>
      )}
      {missing.length > 0 ? (
        <p className="text-sm font-medium text-slate-600" data-queue-missing>
          {missing.length} selected {missing.length === 1 ? "member has" : "members have"} no guardian email:{" "}
          {missing.map((player) => player.name).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function MemberRow({
  player,
  teamLabel,
  selected,
  open,
  context,
  onToggle,
  onOpen,
}: {
  player: ClubPlayer;
  teamLabel: string;
  selected: boolean;
  open: boolean;
  context: StatementContext;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const outstanding = outstandingOf(player);
  const sponsored = sponsorCreditOf(player);
  const days = daysOverdue(player);
  const progress = planProgress(player);
  const promised = promiseStatus(player);

  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-slate-300" data-member={player.regNumber}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-800">
          <input
            type="checkbox"
            checked={selected}
            data-field={`select-${player.id}`}
            onChange={onToggle}
            className="size-5 rounded border-slate-400"
          />
          Send
        </label>
        <PlayerPortrait photo={player.photo} name={player.name} size="sm" />
        <div className="min-w-0 flex-1 basis-44">
          <p className="truncate text-base font-bold text-slate-950">{player.surname ? `${player.surname}, ${player.firstName}` : player.name}</p>
          <p className="truncate text-sm font-medium text-slate-600">
            {player.regNumber} · {teamLabel}
          </p>
          <p className="truncate text-sm font-medium text-slate-600">
            {player.idNumber ? `ID ${player.idNumber}` : "No ID"} · {player.mobile || "No mobile"} ·{" "}
            {player.guardianName || "No guardian"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-member-chips>
          <Chip label="Billed" value={rand(chargedOf(player))} />
          <Chip label="Received" value={rand(paidTotal(player))} />
          <Chip label="Outstanding" value={rand(outstanding)} emphasis={outstanding > 0} />
          {sponsored > 0 ? <Chip label="Sponsored" value={rand(sponsored)} tone="emerald" /> : null}
          {outstanding > 0 ? <Chip label="Ageing" value={bucketOf(days)} tone={days > 60 ? "rose" : "amber"} /> : null}
          {progress ? <Chip label="Agreement" value={`${progress.settled}/${progress.rows.length}`} tone={progress.missed > 0 ? "rose" : "slate"} /> : null}
          {player.promise ? <Chip label="Promise" value={promised ?? "Open"} tone={promised === "Overdue" ? "rose" : promised === "Kept" ? "emerald" : "slate"} /> : null}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="lg" variant="outline" className="h-11" aria-expanded={open} data-field={`open-${player.id}`} onClick={onOpen}>
            {open ? "Close member" : "Manage"}
          </Button>
          <Button type="button" size="lg" variant="outline" className="h-11" data-field={`print-${player.id}`} onClick={() => printStatement(player, context)}>
            Statement
          </Button>
        </div>
      </div>
      {open ? <MemberPanel player={player} /> : null}
    </li>
  );
}

function Chip({ label, value, emphasis = false, tone = "slate" }: { label: string; value: string; emphasis?: boolean; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-950",
    rose: "bg-rose-100 text-rose-900",
  };
  return (
    <span className={`rounded-lg px-3 py-1 text-xs font-bold ${tones[tone]} ${emphasis ? "ring-1 ring-slate-400" : ""}`}>
      {label} <span className="tabular-nums">{value}</span>
    </span>
  );
}

function MemberPanel({ player }: { player: ClubPlayer }) {
  const setPlayerSponsorship = useClubStore((state) => state.setPlayerSponsorship);
  const setPaymentPlan = useClubStore((state) => state.setPaymentPlan);
  const setPromiseToPay = useClubStore((state) => state.setPromiseToPay);
  const addCorrespondence = useClubStore((state) => state.addCorrespondence);
  const outstanding = outstandingOf(player);
  const progress = planProgress(player);
  const promised = promiseStatus(player);

  return (
    <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 lg:grid-cols-3" data-member-panel={player.regNumber}>
      <SponsorshipForm
        player={player}
        onSave={(amount) => {
          setPlayerSponsorship(player.id, amount);
          addCorrespondence(player.id, "Note", amount > 0 ? `Club sponsorship set to ${rand(amount)} against a ${rand(player.seasonFee)} fee.` : "Club sponsorship removed.");
        }}
      />
      <AgreementForm
        player={player}
        defaultAmount={outstanding}
        progress={progress}
        onSave={(plan) => {
          setPaymentPlan(player.id, plan);
          addCorrespondence(player.id, "Note", `Payment agreement of ${rand(plan.instalments.reduce((sum, item) => sum + item.amount, 0))} over ${plan.instalments.length} instalments agreed.`);
        }}
        onRemove={() => {
          setPaymentPlan(player.id, null);
          addCorrespondence(player.id, "Note", "Payment agreement cancelled.");
        }}
      />
      <PromiseForm
        player={player}
        status={promised}
        defaultAmount={outstanding}
        onSave={(promise) => {
          setPromiseToPay(player.id, promise);
          addCorrespondence(player.id, "Call", `Promised ${rand(promise.amount)} by ${formatDay(promise.date)}.`);
        }}
        onRemove={() => {
          setPromiseToPay(player.id, null);
          addCorrespondence(player.id, "Note", "Promise to pay removed.");
        }}
      />
    </div>
  );
}

function SponsorshipForm({ player, onSave }: { player: ClubPlayer; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState(String(player.sponsoredAmount));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const billed = Math.max(0, player.seasonFee - Math.min(value, player.seasonFee));

  return (
    <form
      className="rounded-lg bg-slate-100 p-3"
      data-sponsorship={player.regNumber}
      onSubmit={(event) => {
        event.preventDefault();
        if (value > player.seasonFee) {
          setError(`Sponsorship cannot be more than the ${rand(player.seasonFee)} season fee.`);
          setNotice("");
          return;
        }
        onSave(value);
        setError("");
        setNotice(value > 0 ? `Club covers ${rand(value)} of this fee.` : "Sponsorship removed.");
      }}
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Club sponsorship</h3>
      <p className="mt-1 text-sm font-medium text-slate-600">
        The club covers part or all of the season fee. The sponsored amount is credited on the statement and the family
        is billed for the rest.
      </p>
      <label className="mt-2 block text-sm font-semibold text-slate-800">
        Sponsored amount
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={amount}
          data-field={`sponsorship-${player.id}`}
          onChange={(event) => {
            setAmount(event.target.value);
            setNotice("");
            setError("");
          }}
          className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
        />
      </label>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        Season fee {rand(player.seasonFee)} · billed to the family {rand(billed)}.
      </p>
      <Button type="submit" size="lg" className="mt-2 h-11">
        Save sponsorship
      </Button>
      {notice ? <p className="mt-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </form>
  );
}

function AgreementForm({
  player,
  defaultAmount,
  progress,
  onSave,
  onRemove,
}: {
  player: ClubPlayer;
  defaultAmount: number;
  progress: ReturnType<typeof planProgress>;
  onSave: (plan: ReturnType<typeof buildPlan>) => void;
  onRemove: () => void;
}) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [instalments, setInstalments] = useState("6");
  const [firstDue, setFirstDue] = useState(todayIso());
  const [frequency, setFrequency] = useState<PlanFrequency>("Monthly");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="rounded-lg bg-slate-100 p-3" data-agreement={player.regNumber}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Payment agreement</h3>
      {progress ? (
        <>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {progress.rows.length} instalments covering {rand(progress.total)} agreed on{" "}
            {formatDay(player.paymentPlan?.agreedOn ?? todayIso())} · {progress.settled} paid · {progress.status}.
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {progress.next
              ? `Next instalment ${rand(progress.next.amount)} due ${formatDay(progress.next.dueDate)}.`
              : "Every instalment is covered by the payments recorded."}{" "}
            {progress.remaining > 0 ? `${rand(progress.remaining)} still to pay on the agreement.` : ""}
          </p>
          <ol className="mt-2 space-y-1" data-agreement-schedule>
            {progress.rows.map((instalment, index) => (
              <li
                key={instalment.id}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm font-semibold ${
                  instalment.settled ? "bg-emerald-100 text-emerald-900" : instalment.missed ? "bg-rose-100 text-rose-900" : "bg-white text-slate-700"
                }`}
              >
                <span>
                  {index + 1}. {formatDay(instalment.dueDate)}
                </span>
                <span className="tabular-nums">
                  {rand(instalment.amount)} · {instalment.settled ? "Paid" : instalment.missed ? "Missed" : "Due"}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs font-medium text-slate-600">
            Instalments are marked paid from the payments you record on Accounting after the agreement date.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="lg" variant="outline" className="h-11" data-field={`remove-agreement-${player.id}`} onClick={onRemove}>
              Cancel agreement
            </Button>
          </div>
          {notice ? <p className="mt-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}
        </>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Math.max(0, Math.round(Number(amount) || 0));
            const count = Math.max(1, Math.min(24, Math.round(Number(instalments) || 1)));
            if (value <= 0) {
              setError("Enter the amount to be paid under the agreement.");
              setNotice("");
              return;
            }
            onSave(buildPlan({ amount: value, instalments: count, firstDue, frequency }));
            setError("");
            setNotice(`Agreement saved: ${count} ${count === 1 ? "instalment" : "instalments"} of ${rand(Math.floor(value / count))}.`);
          }}
        >
          <p className="text-sm font-medium text-slate-600">
            Spread what is owed over a time frame. Outstanding now is {rand(defaultAmount)}.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Amount agreed
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={amount}
                data-field={`agreement-amount-${player.id}`}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                }}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Instalments
              <input
                type="number"
                min={1}
                max={24}
                value={instalments}
                data-field={`agreement-instalments-${player.id}`}
                onChange={(event) => setInstalments(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              First instalment due
              <input
                type="date"
                value={firstDue}
                data-field={`agreement-first-${player.id}`}
                onChange={(event) => setFirstDue(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Frequency
              <select
                value={frequency}
                data-field={`agreement-frequency-${player.id}`}
                onChange={(event) => setFrequency(event.target.value as PlanFrequency)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base"
              >
                {PLAN_FREQUENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="submit" size="lg" className="h-11" data-field={`save-agreement-${player.id}`}>
            Save agreement
          </Button>
          {notice ? <p className="text-sm font-semibold text-emerald-800">{notice}</p> : null}
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        </form>
      )}
    </div>
  );
}

function PromiseForm({
  player,
  status,
  defaultAmount,
  onSave,
  onRemove,
}: {
  player: ClubPlayer;
  status: ReturnType<typeof promiseStatus>;
  defaultAmount: number;
  onSave: (promise: { date: string; amount: number; notedOn: string }) => void;
  onRemove: () => void;
}) {
  const [date, setDate] = useState(player.promise?.date ?? todayIso());
  const [amount, setAmount] = useState(player.promise ? String(player.promise.amount) : defaultAmount > 0 ? String(defaultAmount) : "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="rounded-lg bg-slate-100 p-3" data-promise={player.regNumber}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Promise to pay</h3>
      {player.promise ? (
        <>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {rand(player.promise.amount)} promised by {formatDay(player.promise.date)} · {status}.
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Noted on {formatDay(player.promise.notedOn)}. The promise is marked kept as soon as payments recorded on
            or after that date cover the amount.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="lg" variant="outline" className="h-11" data-field={`remove-promise-${player.id}`} onClick={onRemove}>
              Remove promise
            </Button>
          </div>
          {notice ? <p className="mt-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}
        </>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Math.max(0, Math.round(Number(amount) || 0));
            if (value <= 0) {
              setError("Enter the amount the guardian promised.");
              setNotice("");
              return;
            }
            onSave({ date, amount: value, notedOn: todayIso() });
            setError("");
            setNotice(`Promise of ${rand(value)} by ${formatDay(date)} saved.`);
          }}
        >
          <p className="text-sm font-medium text-slate-600">Record what the guardian promised and by when, so it can be chased.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Promised amount
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={amount}
                data-field={`promise-amount-${player.id}`}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                }}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Promised by
              <input
                type="date"
                value={date}
                data-field={`promise-date-${player.id}`}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
          </div>
          <Button type="submit" size="lg" className="h-11" data-field={`save-promise-${player.id}`}>
            Save promise
          </Button>
          {notice ? <p className="text-sm font-semibold text-emerald-800">{notice}</p> : null}
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
