import { createContext, useContext } from "react";
import { t, type Language, type TKey } from "./translations";

type TFunction = (key: TKey, vars?: Record<string, string | number>) => string;

const LanguageContext = createContext<Language>("de");

export const LanguageProvider = LanguageContext.Provider;

export function useT(): TFunction {
  const lang = useContext(LanguageContext);
  return (key: TKey, vars?: Record<string, string | number>) => t(lang, key, vars);
}
