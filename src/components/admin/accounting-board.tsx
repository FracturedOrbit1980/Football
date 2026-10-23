"use client";

import { useState } from "react";

import { PlayerPortrait } from "@/components/club/player-photo";
import { Button } from "@/components/ui/button";
import { ageLabel, ensureYouthAges } from "@/lib/club/age";
import type { ClubPlayer } from "@/lib/club/seed";
import { useClubStore } from "@/stores/club-store";

const randFormat = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

function rand(value: number) {
  return `R ${randFormat.format(Math.max(0, Math.round(value)))}`;
}

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
      received: sum.received + player.feePaid,
      outstanding: sum.outstanding + Math.max(0, player.seasonFee - player.feePaid),
    }),
    { billed: 0, received: 0, outstanding: 0 },
  );
  const awaiting = visible.filter((player) => player.seasonFee > 0 && player.feePaid < player.seasonFee).length;

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
          Record the season fee and the money received. Outstanding is the fee less what was paid. Totals below cover{" "}
          {filterLabel}.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Accounting totals">
        <Total label="Season fees" value={rand(totals.billed)} />
        <Total label="Received" value={rand(totals.received)} />
        <Total label="Outstanding" value={rand(totals.outstanding)} emphasis />
        <Total label="Accounts awaiting" value={String(awaiting)} />
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

function AccountRow({ player, teamLabel }: { player: ClubPlayer; teamLabel: string }) {
  const setPlayerMoney = useClubStore((state) => state.setPlayerMoney);
  const [fee, setFee] = useState(String(player.seasonFee));
  const [paid, setPaid] = useState(String(player.feePaid));
  const [saved, setSaved] = useState("");
  const feeValue = Math.max(0, Math.round(Number(fee) || 0));
  const paidValue = Math.max(0, Math.round(Number(paid) || 0));
  const outstanding = Math.max(0, feeValue - paidValue);
  const status = statusFrom(feeValue, paidValue);

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
      <form
        className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setPlayerMoney(player.id, feeValue, paidValue);
          setSaved("Saved.");
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
          Received
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={paid}
            data-field={`paid-${player.id}`}
            onChange={(event) => {
              setPaid(event.target.value);
              setSaved("");
            }}
            className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
          />
        </label>
        <div>
          <p className="text-sm font-semibold text-slate-800">Outstanding</p>
          <p className="mt-1 flex h-11 items-center text-lg font-black tabular-nums text-slate-950" data-outstanding>
            {rand(outstanding)}
          </p>
        </div>
        <Button type="submit" size="lg" className="h-11">
          Save
        </Button>
      </form>
      {saved ? <p className="mt-2 text-sm font-semibold text-emerald-800">{saved}</p> : null}
    </li>
  );
}
