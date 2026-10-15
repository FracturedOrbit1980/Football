"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCloudSession } from "@/components/cloud/cloud-session";
import { CloudGate, Field, Notice } from "@/components/cloud/cloud-ui";
import { Button } from "@/components/ui/button";
import { appUrl, errorText, getCloud } from "@/lib/cloud/client";

export function LoginForm() {
  const cloud = useCloudSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cloud.session && !cloud.loading) router.replace("/club");
  }, [cloud.loading, cloud.session, router]);

  if (!cloud.enabled) return <CloudGate>{null}</CloudGate>;

  return (
    <form
      className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-300"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        const { error: failure } = await getCloud()!.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: appUrl("/login/"), shouldCreateUser: true },
        });
        setBusy(false);
        if (failure) setError(errorText(failure));
        else setNotice("Check your email for the sign-in link. You can close this tab.");
      }}
    >
      <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </Button>
      <Notice text={notice} />
      <Notice text={error} tone="error" />
      <p className="text-xs font-medium text-slate-600">
        By signing in you acknowledge the{" "}
        <Link href="/privacy" className="text-emerald-800 underline">
          privacy and POPIA notice
        </Link>
        . Your club only sees the information it needs to run teams.
      </p>
    </form>
  );
}
