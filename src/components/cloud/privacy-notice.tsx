"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { getCloud } from "@/lib/cloud/client";
import { INFORMATION_REGULATOR, PRIVACY_POLICY_VERSION, type PrivacyNoticeSettings } from "@/lib/privacy";

function Blank({ value, label }: { value: string | number | null | undefined; label: string }) {
  if (value !== null && value !== undefined && value !== "") return <strong>{value}</strong>;
  return <mark className="rounded bg-amber-200 px-1 font-bold text-amber-950">[{label}]</mark>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-2 space-y-2 text-base leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

/**
 * POPIA notice template. The club is the responsible party; it fills in its information
 * officer and details on the Club screen. Readable without signing in (?club=<id>).
 */
export function PrivacyNotice() {
  const cloud = useCloudSession();
  const [settings, setSettings] = useState<PrivacyNoticeSettings | null>(null);

  useEffect(() => {
    const client = getCloud();
    const fromUrl = new URLSearchParams(window.location.search).get("club");
    const clubId = fromUrl || cloud.activeClubId;
    if (!client || !clubId || !/^[0-9a-f-]{36}$/i.test(clubId)) return;
    client.rpc("get_privacy_notice", { p_club: clubId }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (row) setSettings(row as PrivacyNoticeSettings);
    });
  }, [cloud.activeClubId]);

  const club = settings?.club_name;
  const version = settings?.policy_version || PRIVACY_POLICY_VERSION;

  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-white p-5 ring-1 ring-slate-300" data-privacy-notice>
      <p className="rounded-lg bg-amber-100 p-3 text-sm font-bold text-amber-950 ring-1 ring-amber-300">
        TEMPLATE: this notice must be reviewed and adapted by the club&apos;s legal adviser before it is relied on. It is not
        legal advice. Highlighted fields are set by the club admin.
      </p>
      <h1 className="mt-4 text-[clamp(1.5rem,1.1rem+1.4vw,2.2rem)] font-black tracking-tight text-slate-950">
        Privacy and POPIA notice
      </h1>
      <p className="mt-1 text-sm font-semibold text-slate-600">Version {version}</p>

      <Section title="1. Who is responsible for your information">
        <p>
          The responsible party under the Protection of Personal Information Act, 2013 (POPIA) is{" "}
          <Blank value={settings?.responsible_party || club} label="club legal name" />, of{" "}
          <Blank value={settings?.physical_address} label="club physical address" />.
        </p>
        <p>
          Information officer: <Blank value={settings?.info_officer_name} label="information officer name" />, email{" "}
          <Blank value={settings?.info_officer_email} label="information officer email" />
          {settings?.info_officer_phone ? <>, phone <strong>{settings.info_officer_phone}</strong></> : null}.
        </p>
      </Section>

      <Section title="2. What we collect">
        <ul className="list-disc space-y-1 pl-6">
          <li>Players, most of whom are children: name, date of birth, squad number, position, team, player ID and card number, photo if added, ratings and coach notes, match minutes and attendance.</li>
          <li>Parents and guardians: name, relationship, email address, and contact numbers.</li>
          <li>Club finance per player: subs charged and paid, kit issued and its value, other budget lines.</li>
          <li>Staff and members: name, email address, club role, and teams.</li>
          <li>Sign-in and security records kept by our operator (for example, sign-in times).</li>
        </ul>
        <p>
          Information about a child is processed only with the consent of a parent or guardian, recorded with the notice
          version and time at registration.
        </p>
      </Section>

      <Section title="3. Why we use it">
        <p>
          To register and insure players, run teams, training, and matches, give feedback on development, manage subs,
          kit, and sponsorship obligations, and contact guardians about club activities. We do not sell personal
          information or use it for direct marketing without separate consent.
        </p>
      </Section>

      <Section title="4. Who can see it">
        <p>
          Each club&apos;s records are kept separate from every other club. Inside the club, access depends on role: the
          club admin; the player&apos;s own coach, team manager, and fitness lead; and the player and their guardian for
          their own record only.
        </p>
        <p>
          Operator: the club uses Supabase, Inc. to host its database, sign-in, and files, in{" "}
          <Blank value={settings?.hosting_region} label="hosting region" />. If that region is outside South Africa,
          information is transferred under section 72 of POPIA on the basis of the operator agreement and safeguards.
        </p>
        <p>The app can keep coaching data (drills and match records) on a coach&apos;s device so it works offline. It is removed from the device on sign-out.</p>
      </Section>

      <Section title="5. How long we keep it">
        <p>
          Records are kept while the player is registered and for{" "}
          <Blank value={settings?.retention_months} label="retention months" /> months afterwards, unless the law requires
          longer (for example, financial records). Then they are deleted or de-identified.
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You may ask what information we hold, ask us to correct or delete it, object to processing, or withdraw consent.
          Players and guardians with a portal account can download their data and send an access, correction, or deletion
          request from <strong>My player portal</strong>. Otherwise, email the information officer above. We respond
          within a reasonable time, normally 30 days.
        </p>
      </Section>

      <Section title="7. Complaints">
        <p>
          Please contact the information officer first. You may also complain to the {INFORMATION_REGULATOR.name}:{" "}
          {INFORMATION_REGULATOR.address}; {INFORMATION_REGULATOR.postal}; phone {INFORMATION_REGULATOR.phone}; complaints{" "}
          <a className="underline" href={`mailto:${INFORMATION_REGULATOR.complaints}`}>{INFORMATION_REGULATOR.complaints}</a>; general{" "}
          <a className="underline" href={`mailto:${INFORMATION_REGULATOR.enquiries}`}>{INFORMATION_REGULATOR.enquiries}</a>;{" "}
          <a className="underline" href={INFORMATION_REGULATOR.website} target="_blank" rel="noopener noreferrer">{INFORMATION_REGULATOR.website}</a>.
        </p>
      </Section>

      {!club ? (
        <p className="mt-6 text-sm font-semibold text-slate-600">
          {cloud.enabled ? "Open this page from your club (or with ?club=<club id>) to see the club's details." : "Local demo mode: no club details are stored."}
        </p>
      ) : null}
    </article>
  );
}
