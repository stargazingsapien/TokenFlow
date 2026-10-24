"use client";

import { useI18n } from "./I18nProvider";
import { firebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestedPath = searchParams.get("next") ?? "/control";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8">
      <section className="w-full max-w-md rounded-lg border border-white/70 bg-white p-6 shadow-panel">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-mint">TokenFlow</p>
            <h1 className="mt-2 text-3xl font-black text-ink">{t("staffLogin")}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">{t("staffLoginBody")}</p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setIsSubmitting(true);

            try {
              if (!firebaseAuth) {
                setError(t("invalidLogin"));
                return;
              }
              const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
              const idToken = await credential.user.getIdToken();
              const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
              });

              if (!response.ok) {
                await signOut(firebaseAuth);
                setError(t("invalidLogin"));
                return;
              }

              await signOut(firebaseAuth);
              const destination = new URL(requestedPath, window.location.origin);
              window.location.assign(
                destination.origin === window.location.origin ? destination.href : "/control"
              );
            } catch {
              if (firebaseAuth?.currentUser) await signOut(firebaseAuth).catch(() => undefined);
              setError(t("invalidLogin"));
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm font-bold text-slate-600">
            {t("emailAddress")}
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="rounded-md border border-slate-200 px-3 py-3 text-ink"
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-slate-600">
            {t("password")}
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="rounded-md border border-slate-200 px-3 py-3 text-ink"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm font-bold text-coral">{error}</p>
          ) : null}

          <button
            disabled={isSubmitting}
            className="rounded-lg bg-mint px-4 py-3 font-black text-white transition hover:brightness-95 disabled:bg-slate-300"
          >
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </section>
    </main>
  );
}
