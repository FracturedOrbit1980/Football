"use client";

import { useState } from "react";

import { RolePicker } from "@/components/auth/role-picker";
import { useRole } from "@/components/auth/role-session";
import { CLUB_NAME } from "@/lib/club/catalog";
import {
  DEFAULT_CLUB_ID,
  paymentSummary,
  type ClubBanking,
  type ClubInput,
  type ClubPaymentMethod,
  type ClubPaymentPortal,
  type ClubProfile,
} from "@/lib/club/registry";
import { CLUB_THEMES, type ClubThemeId } from "@/lib/club/themes";
import { activeClub, useClubLibrary } from "@/stores/club-library";

export function ClubStart() {
  const clubs = useClubLibrary((state) => state.clubs);
  const activeId = useClubLibrary((state) => state.activeId);
  const ready = useClubLibrary((state) => state.ready);
  const load = useClubLibrary((state) => state.load);
  const addClub = useClubLibrary((state) => state.addClub);
  const updateClub = useClubLibrary((state) => state.updateClub);
  const deleteClub = useClubLibrary((state) => state.deleteClub);
  const current = activeClub(clubs, activeId);
  const { role, clubScope } = useRole();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const visibleClubs = clubScope ? clubs.filter((club) => club.id === clubScope) : clubs;
  const registeredClubs = clubs.filter((club) => club.kind === "custom");
  // A registration covers one club: only a Developer sign-in can register another once one exists.
  const canRegisterClub = role === "DEVELOPER" || (!role && registeredClubs.length === 0);
  const canEditClub = (clubId: string) =>
    !role || role === "DEVELOPER" || (role === "SUPER_ADMIN" && clubId === clubScope);
  const canDeleteClub = (clubId: string) => clubId !== DEFAULT_CLUB_ID && (!role || role === "DEVELOPER");

  if (!ready) return null;

  return (
    <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
      <div>
      <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">Club</p>
      <h1 className="mt-2 break-words text-[clamp(1.85rem,1.2rem+2.2vw,3.25rem)] font-black leading-[1.12] tracking-tight text-slate-950">{current ? current.name : "Load a club"}</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-700">
        {clubScope
          ? "This sign-in only shows your club. Sign out to open another one; registering a second club needs a Developer sign-in."
          : "Choose a club to open. Players, teams, drills, attendance, and the colours stay with that club."}
      </p>
      <div className="mt-8 grid gap-4" data-club-list>
        {visibleClubs.map((club) => (
          <article
            key={club.id}
            className="rounded-2xl bg-white p-5 ring-1 ring-slate-300 sm:p-6"
            data-club={club.id}
            data-club-active={club.id === activeId ? "true" : undefined}
          >
            <div className="flex flex-wrap items-center gap-3">
              <ClubLogo club={club} />
              <div className="min-w-0 flex-1 basis-40">
                <h2 className="truncate text-lg font-black text-slate-950">{club.name}</h2>
                <p className="text-sm font-semibold text-slate-600">{themeName(club.theme)}</p>
                <p className="text-sm font-medium text-slate-600">{paymentSummary(club)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-load-club={club.id}
                  onClick={() => void load(club.id)}
                  className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold ${
                    club.id === activeId ? "btn-shade" : "btn-quiet"
                  }`}
                >
                  {club.id === activeId ? "Loaded" : "Load"}
                </button>
                {canEditClub(club.id) ? (
                  <button
                    type="button"
                    data-edit-club={club.id}
                    onClick={() => setEditingId(editingId === club.id ? null : club.id)}
                    className="btn-quiet min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold"
                  >
                    Edit
                  </button>
                ) : null}
                {canDeleteClub(club.id) ? (
                  <button
                    type="button"
                    data-delete-club={club.id}
                    onClick={() => {
                      setEditingId(null);
                      setPendingDeleteId(pendingDeleteId === club.id ? null : club.id);
                    }}
                    className="btn-quiet min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
            {editingId === club.id ? (
              <ClubForm
                initial={club}
                submitLabel="Save club"
                onSubmit={(input) => {
                  updateClub(club.id, input);
                  setEditingId(null);
                }}
              />
            ) : null}
            {pendingDeleteId === club.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-100 p-4 ring-1 ring-slate-300">
                <p className="min-w-0 flex-1 basis-48 text-sm font-bold leading-relaxed text-slate-800">
                  Delete {club.name}? Its players, drills, and match records go with it.
                </p>
                <button
                  type="button"
                  data-confirm-delete-club={club.id}
                  onClick={() => {
                    deleteClub(club.id);
                    setPendingDeleteId(null);
                  }}
                  className="btn-danger min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold"
                >
                  Delete club
                </button>
                <button
                  type="button"
                  data-cancel-delete-club={club.id}
                  onClick={() => setPendingDeleteId(null)}
                  className="btn-quiet min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold"
                >
                  Keep club
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      </div>
      <div className="grid content-start gap-8">
      {current ? (
        <div>
          <h2 className="text-lg font-black text-slate-950">Open {current.name}</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">Choose a role to open this club.</p>
          <div className="mt-4">
            <RolePicker />
          </div>
        </div>
      ) : (
        <p className="text-base font-semibold text-slate-700">Load {CLUB_NAME}, or register a club, before you open a role.</p>
      )}
      {canRegisterClub ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-300 sm:p-6" aria-label="Register a club">
          <h2 className="text-lg font-black text-slate-950">Register a club</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
            Registration covers one club only. Its players, fees, statements and colours stay with that club.
          </p>
          <ClubForm
            submitLabel="Register club"
            onSubmit={(input) => {
              void addClub(input);
            }}
          />
        </section>
      ) : !role && registeredClubs.length > 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm font-medium leading-relaxed text-slate-600 ring-1 ring-slate-300" data-one-club-note>
          {registeredClubs[0].name} is registered on this device. Registration covers one club only, so sign in as a
          Developer to register another.
        </p>
      ) : null}
      </div>
    </div>
  );
}

function ClubForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ClubProfile;
  submitLabel: string;
  onSubmit: (input: ClubInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [theme, setTheme] = useState<ClubThemeId>(initial?.theme ?? "red");
  const [paymentMethod, setPaymentMethod] = useState<ClubPaymentMethod>(initial?.paymentMethod ?? "bank");
  const [bankName, setBankName] = useState(initial?.banking.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(initial?.banking.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.banking.accountNumber ?? "");
  const [branchCode, setBranchCode] = useState(initial?.banking.branchCode ?? "");
  const [provider, setProvider] = useState(initial?.portal.provider ?? "");
  const [portalReference, setPortalReference] = useState(initial?.portal.reference ?? "");
  const [portalLink, setPortalLink] = useState(initial?.portal.link ?? "");
  const [notice, setNotice] = useState("");

  function resetPayments() {
    setPaymentMethod("bank");
    setBankName("");
    setAccountHolder("");
    setAccountNumber("");
    setBranchCode("");
    setProvider("");
    setPortalReference("");
    setPortalLink("");
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setNotice("Name the club.");
          return;
        }
        const banking: ClubBanking = { bankName, accountHolder, accountNumber, branchCode };
        const portal: ClubPaymentPortal = { provider, reference: portalReference, link: portalLink };
        onSubmit({ name: name.trim(), logo, theme, paymentMethod, banking, portal });
        if (!initial) {
          setName("");
          setLogo("");
          setTheme("red");
          resetPayments();
        }
        setNotice("Saved with this club.");
      }}
    >
      <label className="block text-sm font-semibold text-slate-800">
        Club name
        <input
          value={name}
          data-field={initial ? "edit-club-name" : "new-club-name"}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-800">
        Club logo
        <input
          type="file"
          accept="image/*"
          data-field={initial ? "edit-club-logo" : "new-club-logo"}
          className="mt-1 block w-full max-w-full text-base file:mr-3 file:h-11 file:rounded-md file:px-3 file:font-bold"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void readLogo(file).then(setLogo).catch(() => setNotice("Use an image under 2 MB."));
          }}
        />
      </label>
      {logo ? <img src={logo} alt="" className="logo-plate size-16 rounded-full object-contain ring-1 ring-slate-300" /> : null}
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Colour</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLUB_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              data-theme={item.id}
              aria-pressed={theme === item.id}
              onClick={() => setTheme(item.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
                theme === item.id ? "btn-shade" : "btn-quiet"
              }`}
            >
              <span className="size-4 rounded-full" style={{ background: item.swatch }} />
              {item.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="rounded-xl bg-slate-100 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">How you collect fees</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            data-field="club-payment-bank"
            aria-pressed={paymentMethod === "bank"}
            onClick={() => setPaymentMethod("bank")}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold ${
              paymentMethod === "bank" ? "btn-shade" : "btn-quiet"
            }`}
          >
            Bank transfer
          </button>
          <button
            type="button"
            data-field="club-payment-portal"
            aria-pressed={paymentMethod === "portal"}
            onClick={() => setPaymentMethod("portal")}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold ${
              paymentMethod === "portal" ? "btn-shade" : "btn-quiet"
            }`}
          >
            Payment portal
          </button>
        </div>
        {paymentMethod === "bank" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Bank
              <input
                value={bankName}
                data-field="club-bank-name"
                onChange={(event) => setBankName(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Account holder
              <input
                value={accountHolder}
                data-field="club-bank-holder"
                onChange={(event) => setAccountHolder(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Account number
              <input
                value={accountNumber}
                data-field="club-bank-account"
                inputMode="numeric"
                onChange={(event) => setAccountNumber(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Branch code
              <input
                value={branchCode}
                data-field="club-bank-branch"
                inputMode="numeric"
                onChange={(event) => setBranchCode(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base tabular-nums"
              />
            </label>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Portal provider
              <input
                value={provider}
                data-field="club-portal-provider"
                placeholder="PayFast, Yoco, Ozow…"
                onChange={(event) => setProvider(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Merchant reference
              <input
                value={portalReference}
                data-field="club-portal-reference"
                onChange={(event) => setPortalReference(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              Payment link
              <input
                type="url"
                value={portalLink}
                data-field="club-portal-link"
                placeholder="https://"
                onChange={(event) => setPortalLink(event.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-xs font-medium text-slate-600">
          These details print on guardian statements. Payments received are still recorded on Accounting.
        </p>
      </fieldset>
      <button type="submit" className="btn-shade min-h-11 rounded-lg px-4 text-sm font-bold">
        {submitLabel}
      </button>
      {notice ? <p className="text-sm font-semibold text-slate-700">{notice}</p> : null}
    </form>
  );
}

function ClubLogo({ club }: { club: ClubProfile }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!club.logo && club.id === DEFAULT_CLUB_ID) {
    return (
      <span className="club-mark grid size-12 shrink-0 place-items-center rounded-full bg-[#0b1b33] ring-1 ring-slate-300 dark:bg-transparent dark:ring-0">
        <img
          src={`${base}/icons/clubstride-symbol-dark.png`}
          alt=""
          className="size-10 object-contain dark:size-12"
        />
      </span>
    );
  }
  const src = club.logo || "";
  if (!src) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">
        {club.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" className="logo-plate size-12 shrink-0 rounded-full object-contain ring-1 ring-slate-300" />;
}

function themeName(id: ClubThemeId) {
  return CLUB_THEMES.find((theme) => theme.id === id)?.name ?? "Clubstride";
}

function readLogo(file: File) {
  if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error("large"));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(String(reader.result));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        const scale = Math.min(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("image"));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
