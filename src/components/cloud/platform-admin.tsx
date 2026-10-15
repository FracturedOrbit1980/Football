"use client";

import { useEffect, useState } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { CloudGate, Field, Notice, Panel } from "@/components/cloud/cloud-ui";
import { Button } from "@/components/ui/button";
import { errorText, getCloud } from "@/lib/cloud/client";
import type { Club } from "@/lib/cloud/types";

export function PlatformAdmin() {
  return (
    <CloudGate platform>
      <PlatformScreen />
    </CloudGate>
  );
}

function PlatformScreen() {
  const { refresh } = useCloudSession();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prefix, setPrefix] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCloud()
      ?.from("clubs")
      .select("id, name, player_code_prefix")
      .order("name")
      .then(({ data }) => setClubs((data ?? []) as Club[]));
  }, [version]);

  return (
    <>
      <Panel title="New club">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const { error: failure } = await getCloud()!.rpc("create_club", {
              p_name: name,
              p_admin_email: email,
              p_prefix: prefix || "P",
            });
            if (failure) {
              setError(errorText(failure));
              return;
            }
            setNotice(`${name} created. ${email} becomes club admin after signing in with that address.`);
            setName("");
            setEmail("");
            setPrefix("");
            setVersion((value) => value + 1);
            void refresh();
          }}
        >
          <Field label="Club name" required value={name} onChange={(event) => setName(event.target.value)} />
          <Field label="First club admin email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field
            label="Player ID prefix"
            hint="1–6 capitals or digits, e.g. SPF"
            pattern="[A-Za-z0-9]{1,6}"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value.toUpperCase())}
          />
          <Button type="submit" className="h-11 sm:col-span-3">
            Create club and send invite
          </Button>
        </form>
        <Notice text={notice} />
        <Notice text={error} tone="error" />
      </Panel>
      <Panel title={`Clubs (${clubs.length})`}>
        <ul className="space-y-1">
          {clubs.map((club) => (
            <li key={club.id} className="text-base font-semibold text-slate-900">
              {club.name} <span className="text-sm text-slate-600">· IDs {club.player_code_prefix}00001…</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
