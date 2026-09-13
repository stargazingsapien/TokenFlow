import { TokenStatus } from "@/lib/queue";
import { useI18n } from "./I18nProvider";

const styles: Record<TokenStatus, string> = {
  WAITING: "bg-amber-100 text-amber-800",
  SERVING: "bg-mint/15 text-mint",
  COMPLETED: "bg-slate-200 text-slate-600",
  SKIPPED: "bg-coral/15 text-coral"
};

export function StatusPill({ status }: { status: TokenStatus }) {
  const { t } = useI18n();
  const labels: Record<TokenStatus, ReturnType<typeof t>> = {
    WAITING: t("statusWaiting"),
    SERVING: t("statusServing"),
    COMPLETED: t("statusCompleted"),
    SKIPPED: t("statusSkipped")
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
