"use client";

import { Language, TranslationKey, languageOptions, translations } from "@/lib/i18n";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LANGUAGE_KEY = "tokenflow.language.v1";

type I18nContextValue = {
  language: Language;
  currentLanguage: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const savedLanguage = readSavedLanguage();
    if (savedLanguage) setLanguageState(savedLanguage);
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    try {
      window.localStorage?.setItem(LANGUAGE_KEY, nextLanguage);
      document.cookie = `${LANGUAGE_KEY}=${nextLanguage}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Language persistence is best-effort.
    }
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      currentLanguage: language,
      setLanguage,
      t: (key) => translations[language][key]
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
      <span className="hidden sm:inline">{t("language")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 font-bold text-ink"
      >
        {languageOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function readSavedLanguage(): Language | null {
  try {
    const saved = window.localStorage?.getItem(LANGUAGE_KEY);
    if (isLanguage(saved)) return saved;

    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${LANGUAGE_KEY}=`))
      ?.split("=")[1];

    return isLanguage(cookie) ? cookie : null;
  } catch {
    return null;
  }
}

function isLanguage(value: string | null | undefined): value is Language {
  return value === "en" || value === "gu" || value === "hi";
}
