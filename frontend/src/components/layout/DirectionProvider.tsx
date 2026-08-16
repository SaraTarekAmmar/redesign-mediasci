import React, { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { syncDocumentLanguage } from "../../i18n/config";

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useLayoutEffect(() => {
    syncDocumentLanguage(i18n.language);
  }, [i18n.language]);

  return <>{children}</>;
}
