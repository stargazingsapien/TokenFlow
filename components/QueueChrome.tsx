"use client";

import { TranslationKey } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher, useI18n } from "./I18nProvider";
import { QueueProvider } from "./QueueProvider";

const links: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "/control", labelKey: "navControl" },
  { href: "/patient?token=1", labelKey: "navPatient" },
  { href: "/display", labelKey: "navDisplay" }
];

export function QueueChrome({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const isStaffScreen = pathname?.startsWith("/control") || pathname?.startsWith("/display");

  return (
    <QueueProvider>
      <main className="min-h-screen px-4 py-5 sm:px-8">
        <nav className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/80 px-4 py-3 shadow-panel backdrop-blur">
          <Link href="/" className="text-lg font-black text-ink">
            TokenFlow
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-ink"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </div>
            <LanguageSwitcher />
            {isStaffScreen ? (
              <button
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" });
                  window.location.assign("/login");
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-coral hover:text-coral"
              >
                {t("logout")}
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-mint hover:text-mint"
              >
                {t("login")}
              </Link>
            )}
          </div>
        </nav>
        {children}
      </main>
    </QueueProvider>
  );
}
