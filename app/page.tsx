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
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center gap-8 sm:gap-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-black tracking-tight text-ink">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg text-white">T</span>
            TokenFlow
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />{t("homeKicker")}
          </p>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-7xl">
            {t("homeTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {t("homeBody")}
          </p>
          <Link href="/control" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slatepanel">
            {t("navControl")} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {entryPoints.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-panel"
            >
              <span className="flex items-center justify-between text-xl font-bold text-ink">
                {item.title}<span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-mint">↗</span>
              </span>
              <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{item.body}</p>
              <span className="mt-6 inline-flex text-sm font-bold text-mint">{t("open")} <span className="ml-1">→</span></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
