export interface Language {
  code: string;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
];

export const DEFAULT_LANGUAGE = "en";

export function getLanguage(code: string): Language {
  if (!code) return SUPPORTED_LANGUAGES[0];
  const cleanCode = code.split("-")[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l.code === cleanCode) ?? SUPPORTED_LANGUAGES[0];
}
