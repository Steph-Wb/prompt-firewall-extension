export const TRANSLATIONS = {
  de: {
    // Nav
    "nav.anonymizer": "Anonymizer",
    "nav.dictionary": "Wörterbuch",
    "nav.settings": "Einstellungen",

    // AnonymizePanel
    "sec.input": "1 · Eingabe",
    "input.placeholder": "Text mit sensiblen Daten hier einfügen…",
    "input.toolarge": "Text zu lang ({count} Zeichen). Max. 30.000 Zeichen.",
    "btn.anonymize": "Anonymisieren",
    "btn.reset": "Zurücksetzen",
    "sec.output": "2 · Anonymisierter Text",
    "hint.interactive": "Wörter markieren → anonymisieren · Platzhalter anklicken → aufheben",
    "btn.copy": "Kopieren",
    "btn.copied": "Kopiert ✓",
    "label.entities": "Erkannte Entitäten ({count})",
    "sec.reidentify": "3 · AI-Antwort re-identifizieren",
    "hint.reidentify": 'Antwort von ChatGPT / Claude einfügen – [[PERSON_1]] wird durch echte Werte ersetzt.',
    "ai.placeholder": "Antwort der KI hier einfügen…",
    "btn.reidentify": "Re-Identifizieren",
    "label.reidentified": "Re-identifizierte Antwort",
    "empty.hint": 'Füge Text ein – oder klicke auf der KI-Seite auf „🔒 Anonymisieren".',
    "selection.anonymize": "Anonymisieren",
    "selection.unanonymize": "Un-Anonymisieren",

    // DictionaryPanel
    "dict.new": "Neuer Eintrag",
    "dict.term.placeholder": "Begriff oder Regex-Pattern",
    "dict.category.placeholder": "Kategorie (z. B. MANDANT)",
    "dict.regex.label": "Regex",
    "btn.add": "Hinzufügen",
    "dict.entries": "Einträge ({count})",
    "dict.empty": "Noch keine benutzerdefinierten Begriffe.",
    "dict.error.regex": "Ungültiger Regex: {error}",
    "dict.remove": "{term} entfernen",

    // SettingsPanel
    "settings.language.label": "Sprache der Anonymisierung",
    "settings.save": "Einstellungen speichern",
    "settings.saved": "Gespeichert ✓",
    "settings.privacy":
      "Alle Daten bleiben lokal in deinem Browser. Es werden keine Informationen an externe Server gesendet.",

    // Language options
    "lang.de": "Deutsch (DACH)",
    "lang.en": "English",
  },

  en: {
    // Nav
    "nav.anonymizer": "Anonymizer",
    "nav.dictionary": "Dictionary",
    "nav.settings": "Settings",

    // AnonymizePanel
    "sec.input": "1 · Input",
    "input.placeholder": "Paste text with sensitive data here…",
    "input.toolarge": "Text too long ({count} characters). Max. 30,000 characters.",
    "btn.anonymize": "Anonymize",
    "btn.reset": "Reset",
    "sec.output": "2 · Anonymized Text",
    "hint.interactive": "Select words → anonymize · Click placeholder → restore",
    "btn.copy": "Copy",
    "btn.copied": "Copied ✓",
    "label.entities": "Detected entities ({count})",
    "sec.reidentify": "3 · Re-identify AI response",
    "hint.reidentify": 'Paste the ChatGPT / Claude response – [[PERSON_1]] will be replaced with real values.',
    "ai.placeholder": "Paste AI response here…",
    "btn.reidentify": "Re-identify",
    "label.reidentified": "Re-identified response",
    "empty.hint": 'Paste text – or click "🔒 Anonymize" on the AI site.',
    "selection.anonymize": "Anonymize",
    "selection.unanonymize": "Restore original",

    // DictionaryPanel
    "dict.new": "New entry",
    "dict.term.placeholder": "Term or regex pattern",
    "dict.category.placeholder": "Category (e.g. CLIENT)",
    "dict.regex.label": "Regex",
    "btn.add": "Add",
    "dict.entries": "Entries ({count})",
    "dict.empty": "No custom terms yet.",
    "dict.error.regex": "Invalid regex: {error}",
    "dict.remove": "Remove {term}",

    // SettingsPanel
    "settings.language.label": "Anonymization language",
    "settings.save": "Save settings",
    "settings.saved": "Saved ✓",
    "settings.privacy":
      "All data stays local in your browser. No information is sent to external servers.",

    // Language options
    "lang.de": "Deutsch (DACH)",
    "lang.en": "English",
  },
} as const;

export type Language = keyof typeof TRANSLATIONS;
export type TKey = keyof typeof TRANSLATIONS["de"];

export function t(
  lang: Language,
  key: TKey,
  vars?: Record<string, string | number>
): string {
  let str = TRANSLATIONS[lang][key] as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
