import { TokenStatus } from "@/lib/queue";
import { useI18n } from "./I18nProvider";

const styles: Record<TokenStatus, string> = {
  WAITING: "bg-amber-50 text-amber-800 border border-amber-200/80",
  SERVING: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-black",
  COMPLETED: "bg-slate-100 text-slate-700 border border-slate-200",
  SKIPPED: "bg-orange-50 text-orange-700 border border-orange-200",
  CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200 line-through opacity-70"
};

export function StatusPill({ status }: { status: TokenStatus }) {
  const { t } = useI18n();

  const labels: Record<TokenStatus, string> = {
    WAITING: t("statusWaiting"),
    SERVING: t("statusServing"),
    COMPLETED: t("statusCompleted"),
    SKIPPED: t("statusSkipped"),
    CANCELLED: t("statusCancelled")
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
        styles[status] || styles.WAITING
      }`}
    >
      {status === "SERVING" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
        </span>
      )}
      {status === "COMPLETED" && <span>✓</span>}
      {status === "SKIPPED" && <span>⏭</span>}
      {status === "CANCELLED" && <span>✕</span>}
      {labels[status] || status}
    </span>
  );
}
