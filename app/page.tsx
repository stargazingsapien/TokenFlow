"use client";

import { LanguageSwitcher, useI18n } from "@/components/I18nProvider";
import Link from "next/link";

export default function Home() {
  const { t } = useI18n();
  const entryPoints = [
    {
      title: t("navControl"),
      href: "/control",
      body: t("controlBody")
    },
    {
      title: t("navPatient"),
      href: "/patient?token=1",
      body: t("patientBody")
    },
    {
      title: t("navDisplay"),
      href: "/display",
      body: t("displayBody")
    }
  ];

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center gap-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-black text-ink">
            TokenFlow
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{t("homeKicker")}</p>
          <h1 className="mt-3 text-5xl font-black leading-tight text-ink sm:text-7xl">
            {t("homeTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            {t("homeBody")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {entryPoints.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-panel transition hover:-translate-y-1 hover:border-mint"
            >
              <span className="text-xl font-bold text-ink">{item.title}</span>
              <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{item.body}</p>
              <span className="mt-6 inline-flex text-sm font-bold text-mint">{t("open")}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
