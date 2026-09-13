import { LanguageSwitcher } from "@/components/I18nProvider";
import { LoginForm } from "@/components/LoginForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <>
      <div className="fixed right-5 top-5 z-10 rounded-lg border border-white/70 bg-white/80 px-4 py-3 shadow-panel backdrop-blur">
        <LanguageSwitcher />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
