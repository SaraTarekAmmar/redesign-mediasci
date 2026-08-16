import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, getLanguage } from "./languages";

import enCommon from "./resources/en/common.json";
import arCommon from "./resources/ar/common.json";
import enNav from "./resources/en/nav.json";
import arNav from "./resources/ar/nav.json";

export function syncDocumentLanguage(lng = i18n.language) {
  const lang = getLanguage(lng);
  document.documentElement.dir = lang.dir;
  document.documentElement.lang = lang.code;
  document.body.dir = lang.dir;
}

try {
  const bootLocale = (window as any).__DATA__?.user?.locale;
  if (bootLocale && !localStorage.getItem("i18nextLng")) {
    localStorage.setItem("i18nextLng", bootLocale);
  }
} catch {
  /* ignore storage failures */
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    ns: ["common", "nav"],
    defaultNS: "common",
    resources: {
      en: { common: enCommon, nav: enNav },
      ar: { common: arCommon, nav: arNav },
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

i18n.dir = (lng?: string): "ltr" | "rtl" => {
  const currentLng = lng || i18n.language || DEFAULT_LANGUAGE;
  return getLanguage(currentLng).dir;
};

i18n.on("initialized", () => {
  syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE);
});

i18n.on("languageChanged", (lng) => {
  syncDocumentLanguage(lng);
});

export default i18n;
