"use client";

import { useI18n } from "./I18nProvider";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = searchParams.get("next") ?? "/control";

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

            const response = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password })
            });

            setIsSubmitting(false);

            if (!response.ok) {
              setError(t("invalidLogin"));
              return;
            }

            window.location.assign(nextPath);
          }}
        >
          <label className="grid gap-1 text-sm font-bold text-slate-600">
            {t("username")}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="rounded-md border border-slate-200 px-3 py-3 text-ink"
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-slate-600">
            {t("password")}
            <input
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
