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
  const isDisplayScreen = pathname === "/display";

  return (
    <QueueProvider>
      <main className={`min-h-screen ${isDisplayScreen ? "px-4 py-3" : "px-4 py-5 sm:px-8"}`}>
        {!isDisplayScreen && (
          <nav
            aria-label="Main navigation"
            className="mx-auto mb-8 flex max-w-[1400px] flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4"
          >
            <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
                TF
              </span>
              <span>
                TokenFlow
                <span className="ml-2 hidden text-xs font-medium tracking-normal text-slate-400 sm:inline">
                  CLINIC OPERATIONS
                </span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {links.map((link) => {
                  const isActive = pathname === link.href.split("?")[0];
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-slate-100 text-ink"
                          : "text-slate-500 hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      {t(link.labelKey)}
                    </Link>
                  );
                })}
              </div>
              <LanguageSwitcher />
              {isStaffScreen ? (
                <button
                  onClick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    window.location.assign("/login");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                >
                  {t("logout")}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-800"
                >
                  {t("login")}
                </Link>
              )}
            </div>
          </nav>
        )}
        {children}
      </main>
    </QueueProvider>
  );
}
