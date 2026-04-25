/**
 * Prompt-Firewall Anonymisierungs-Engine
 *
 * Dreischichtige Erkennung:
 * - Schicht 1: Regex-basiert (E-Mail, Telefon, IBAN, Steuernummer, Datum, ORG-Suffixe, etc.)
 * - Schicht 2: NER-Simulation für deutsche Texte (Personen mit Anrede, Orte)
 * - Schicht 2b: Vornamen-Listen-Erkennung (Standalone-Namen ohne expliziten Kontext)
 *
 * Das Mapping lebt ausschließlich im RAM und wird niemals persistent gespeichert.
 */

import GERMAN_FIRST_NAMES_DATA from "../data/german-first-names.json";

const GERMAN_FIRST_NAMES: string[] = GERMAN_FIRST_NAMES_DATA as string[];

export interface DetectedEntity {
  type: string;
  original: string;
  placeholder: string;
  start: number;
  end: number;
}

export interface AnonymizationResult {
  anonymizedText: string;
  entities: DetectedEntity[];
}

export interface SessionMapping {
  [placeholder: string]: string;
}

// ─── In-Memory Mapping Store (RAM only, never persisted) ───────────────────

const sessionMappings = new Map<string, SessionMapping>();
const sessionCounters = new Map<string, Map<string, number>>();

export function getSessionMapping(sessionKey: string): SessionMapping {
  if (!sessionMappings.has(sessionKey)) {
    sessionMappings.set(sessionKey, {});
  }
  return sessionMappings.get(sessionKey)!;
}

export function clearSessionMapping(sessionKey: string): void {
  sessionMappings.delete(sessionKey);
  sessionCounters.delete(sessionKey);
}

export function clearAllMappings(): void {
  sessionMappings.clear();
  sessionCounters.clear();
}

function getNextPlaceholder(sessionKey: string, type: string): string {
  if (!sessionCounters.has(sessionKey)) {
    sessionCounters.set(sessionKey, new Map());
  }
  const counters = sessionCounters.get(sessionKey)!;
  const current = counters.get(type) || 0;
  const next = current + 1;
  counters.set(type, next);
  return `[[${type}_${next}]]`;
}

function findExistingPlaceholder(sessionKey: string, original: string): string | null {
  const mapping = getSessionMapping(sessionKey);
  for (const [placeholder, value] of Object.entries(mapping)) {
    if (value === original) return placeholder;
  }
  return null;
}

// ─── Vornamen-Set (einmalig geladen, O(1) Lookup) ─────────────────────────
const FIRST_NAME_SET = new Set(GERMAN_FIRST_NAMES.map((n) => n.toLowerCase()));

// ─── Schicht 1: Regex-basierte Erkennung ───────────────────────────────────

interface RegexPattern {
  type: string;
  pattern: RegExp;
}

const REGEX_PATTERNS: RegexPattern[] = [
  { type: "EMAIL", pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { type: "IBAN", pattern: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,4}\s?\d{0,2}\b/g },
  { type: "STEUERNR", pattern: /\b\d{2,3}\/?\d{3}\/?\d{4,5}\b/g },
  { type: "AHV", pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g },
  { type: "TELEFON", pattern: /(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{2,8}/g },
  { type: "DATUM", pattern: /\b(?:0?[1-9]|[12]\d|3[01])[.\-\/](?:0?[1-9]|1[0-2])[.\-\/](?:19|20)\d{2}\b/g },
  {
    type: "PLZ",
    pattern: /\b(?:(?:D-|A-|CH-)\d{4,5}|(?:PLZ|Postleitzahl)[\s:]*\d{4,5}|\d{5}(?=\s+[A-ZÄÖÜ][a-zäöüß]))\b/g,
  },
  { type: "KUNDENNR", pattern: /\b(?:KD|KNR|Kd\.?Nr\.?|Kundennr\.?|Mandant(?:ennr)?\.?)[\s\-:]*\d{4,10}\b/gi },
  {
    type: "ORG",
    pattern:
      /(?:[A-ZÄÖÜ0-9][A-ZÄÖÜa-zäöüß0-9&\-\.]*(?:\s+[A-ZÄÖÜ0-9&][A-ZÄÖÜa-zäöüß0-9&\-\.]*){0,3})\s+(?:GmbH\s*&\s*Co\.?\s*KG|GmbH|AG|KG|OHG|GbR|e\.V\.|eG|SE|PartGmbB|PartG|UG\s*\(haftungsbeschränkt\)|UG|Inc\.|Ltd\.|S\.A\.|LLC)/g,
  },
  { type: "KREDITKARTE", pattern: /\b(?:\d{4}[\s\-]){3}\d{4}\b/g },
  { type: "SVNR", pattern: /\b\d{2}\s*\d{6}\s*[A-ZÄÖÜ]\s*\d{3}\b/g },
  { type: "SVNR_AT", pattern: /\b\d{4}\s+(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}\b/g },
  {
    type: "AUSWEISNR",
    pattern:
      /\b(?:Ausweis(?:nr\.?|nummer)|Perso(?:nalausweis)?(?:nr\.?|nummer)?|Pass(?:nr\.?|nummer))[\s:\-]*[A-Z0-9]{9}\b/gi,
  },
  { type: "BIC", pattern: /\b(?:BIC|SWIFT)[\s:\-]*[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/gi },
];

function applyRegexPatterns(
  text: string,
  sessionKey: string,
  customPatterns: RegexPattern[] = []
): { text: string; entities: DetectedEntity[] } {
  const allPatterns = [...REGEX_PATTERNS, ...customPatterns];
  const entities: DetectedEntity[] = [];
  let result = text;

  const allMatches: Array<{ type: string; match: string; start: number; end: number }> = [];

  for (const { type, pattern } of allPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (type === "PLZ" && match[0].length < 4) continue;
      if (type === "TELEFON" && match[0].replace(/\D/g, "").length < 6) continue;
      allMatches.push({ type, match: match[0], start: match.index, end: match.index + match[0].length });
    }
  }

  allMatches.sort((a, b) => {
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    return lenDiff !== 0 ? lenDiff : b.start - a.start;
  });

  const filteredMatches: typeof allMatches = [];
  for (const m of allMatches) {
    if (!filteredMatches.some((e) => m.start < e.end && m.end > e.start)) {
      filteredMatches.push(m);
    }
  }

  filteredMatches.sort((a, b) => b.start - a.start);

  for (const { type, match, start, end } of filteredMatches) {
    let placeholder = findExistingPlaceholder(sessionKey, match);
    if (!placeholder) {
      placeholder = getNextPlaceholder(sessionKey, type);
      getSessionMapping(sessionKey)[placeholder] = match;
    }
    entities.push({ type, original: match, placeholder, start, end });
    result = result.substring(0, start) + placeholder + result.substring(end);
  }

  return { text: result, entities };
}

// ─── Schicht 2: NER-Simulation ────────────────────────────────────────────

const GERMAN_NAME_PATTERNS = [
  /(?:Herr|Frau|Hr\.|Fr\.)\s+(?:Dr\.\s+)?(?:(?:von|van|de|zu)\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?/g,
  /(?:Rechtsanwalt|Rechtsanwältin|RA|RAin|Notar|Notarin|Steuerberater|Steuerberaterin|StB)\s+(?:(?:von|van|de|zu)\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?/g,
  /(?:Mandant(?:in)?|Kläger(?:in)?|Beklagte[rn]?|Zeuge|Zeugin)\s+(?:(?:von|van|de|zu)\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?/g,
];

const GERMAN_ORG_PATTERNS = [
  /(?:Kanzlei|Firma|Unternehmen|Gesellschaft|Verein|Stiftung|Bank|Versicherung)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ&][a-zäöüß]*)*/g,
];

const GERMAN_LOCATION_PATTERNS = [
  /(?:in|aus|nach|von|bei|über)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:am|an\s+der|ob\s+der|im)\s+[A-ZÄÖÜ][a-zäöüß]+)?/g,
  /[A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.|gasse|weg|platz|allee|ring|damm|ufer|brücke)\s*\d{1,4}[a-z]?/gi,
];

function applyNerPatterns(
  text: string,
  sessionKey: string
): { text: string; entities: DetectedEntity[] } {
  const nerMatches: Array<{ type: string; match: string; start: number; end: number }> = [];

  for (const pattern of GERMAN_NAME_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const nameOnly = fullMatch.replace(
        /^(?:Herr|Frau|Hr\.|Fr\.|Dr\.|Rechtsanwalt|Rechtsanwältin|RA|RAin|Notar|Notarin|Steuerberater|Steuerberaterin|StB|Mandant(?:in)?|Kläger(?:in)?|Beklagte[rn]?|Zeuge|Zeugin)\s+/,
        ""
      );
      if (nameOnly.length > 2) {
        nerMatches.push({
          type: "PERSON",
          match: nameOnly,
          start: match.index + (fullMatch.length - nameOnly.length),
          end: match.index + fullMatch.length,
        });
      }
    }
  }

  for (const pattern of GERMAN_ORG_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      nerMatches.push({ type: "ORG", match: match[0], start: match.index, end: match.index + match[0].length });
    }
  }

  for (const pattern of GERMAN_LOCATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const locOnly = fullMatch.replace(/^(?:in|aus|nach|von|bei|über)\s+/, "");
      if (locOnly.length > 2) {
        nerMatches.push({
          type: "ORT",
          match: locOnly,
          start: match.index + (fullMatch.length - locOnly.length),
          end: match.index + fullMatch.length,
        });
      }
    }
  }

  nerMatches.sort((a, b) => b.start - a.start);
  const filteredMatches: typeof nerMatches = [];
  for (const m of nerMatches) {
    if (!filteredMatches.some((e) => m.start < e.end && m.end > e.start)) {
      filteredMatches.push(m);
    }
  }

  const entities: DetectedEntity[] = [];
  let result = text;

  for (const { type, match, start, end } of filteredMatches) {
    let placeholder = findExistingPlaceholder(sessionKey, match);
    if (!placeholder) {
      placeholder = getNextPlaceholder(sessionKey, type);
      getSessionMapping(sessionKey)[placeholder] = match;
    }
    entities.push({ type, original: match, placeholder, start, end });
    result = result.substring(0, start) + placeholder + result.substring(end);
  }

  return { text: result, entities };
}

// ─── Schicht 2b: Vornamen-Listen-Erkennung ─────────────────────────────────

function applyNameListDetection(
  text: string,
  sessionKey: string
): { text: string; entities: DetectedEntity[] } {
  const nameMatches: Array<{ type: string; match: string; start: number; end: number }> = [];
  const capitalizedWord = /\b([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)\b/g;
  let m;

  while ((m = capitalizedWord.exec(text)) !== null) {
    const word = m[0];
    if (!FIRST_NAME_SET.has(word.toLowerCase())) continue;

    const afterFirst = text.slice(m.index + word.length);
    const lastNameMatch = /^\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)\b/.exec(afterFirst);

    const fullName = lastNameMatch ? word + " " + lastNameMatch[1] : word;
    nameMatches.push({ type: "PERSON", match: fullName, start: m.index, end: m.index + fullName.length });
  }

  nameMatches.sort((a, b) => {
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    return lenDiff !== 0 ? lenDiff : b.start - a.start;
  });

  const filtered: typeof nameMatches = [];
  for (const nm of nameMatches) {
    if (!filtered.some((ex) => nm.start < ex.end && nm.end > ex.start)) filtered.push(nm);
  }
  filtered.sort((a, b) => b.start - a.start);

  const entities: DetectedEntity[] = [];
  let result = text;

  for (const { type, match, start, end } of filtered) {
    let placeholder = findExistingPlaceholder(sessionKey, match);
    if (!placeholder) {
      placeholder = getNextPlaceholder(sessionKey, type);
      getSessionMapping(sessionKey)[placeholder] = match;
    }
    entities.push({ type, original: match, placeholder, start, end });
    result = result.substring(0, start) + placeholder + result.substring(end);
  }

  return { text: result, entities };
}

// ─── Custom Dictionary ────────────────────────────────────────────────────

export interface DictionaryEntry {
  term: string;
  category: string;
  isRegex: boolean;
  label?: string | null;
}

function applyDictionary(
  text: string,
  sessionKey: string,
  dictionary: DictionaryEntry[]
): { text: string; entities: DetectedEntity[] } {
  const dictMatches: Array<{ type: string; match: string; start: number; end: number }> = [];

  for (const entry of dictionary) {
    const type = (entry.label || entry.category || "CUSTOM").toUpperCase();
    let regex: RegExp;
    if (entry.isRegex) {
      try { regex = new RegExp(entry.term, "gi"); } catch { continue; }
    } else {
      const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`(?<![a-zA-ZäöüÄÖÜß])${escaped}(?![a-zA-ZäöüÄÖÜß])`, "gi");
    }
    let match;
    while ((match = regex.exec(text)) !== null) {
      dictMatches.push({ type, match: match[0], start: match.index, end: match.index + match[0].length });
    }
  }

  dictMatches.sort((a, b) => b.start - a.start);
  const filteredMatches: typeof dictMatches = [];
  for (const m of dictMatches) {
    if (!filteredMatches.some((e) => m.start < e.end && m.end > e.start)) filteredMatches.push(m);
  }

  const entities: DetectedEntity[] = [];
  let result = text;

  for (const { type, match, start, end } of filteredMatches) {
    let placeholder = findExistingPlaceholder(sessionKey, match);
    if (!placeholder) {
      placeholder = getNextPlaceholder(sessionKey, type);
      getSessionMapping(sessionKey)[placeholder] = match;
    }
    entities.push({ type, original: match, placeholder, start, end });
    result = result.substring(0, start) + placeholder + result.substring(end);
  }

  return { text: result, entities };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────

export function anonymize(
  text: string,
  sessionKey: string,
  dictionary: DictionaryEntry[] = []
): AnonymizationResult {
  const dictResult = applyDictionary(text, sessionKey, dictionary);
  const regexResult = applyRegexPatterns(dictResult.text, sessionKey);
  const nerResult = applyNerPatterns(regexResult.text, sessionKey);
  const nameListResult = applyNameListDetection(nerResult.text, sessionKey);
  const leakCheck = applyRegexPatterns(nameListResult.text, sessionKey);

  return {
    anonymizedText: leakCheck.text,
    entities: [
      ...dictResult.entities,
      ...regexResult.entities,
      ...nerResult.entities,
      ...nameListResult.entities,
      ...leakCheck.entities,
    ],
  };
}

export function reidentify(text: string, sessionKey: string): string {
  const mapping = getSessionMapping(sessionKey);
  let result = text;
  const sortedPlaceholders = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const placeholder of sortedPlaceholders) {
    result = result.split(placeholder).join(mapping[placeholder]);
  }
  return result;
}

export function getSessionCounters(sessionKey: string): Map<string, number> {
  return sessionCounters.get(sessionKey) ?? new Map();
}

export function setSessionMapping(sessionKey: string, mapping: SessionMapping): void {
  sessionMappings.set(sessionKey, { ...mapping });
}

export function setSessionCounters(sessionKey: string, counters: Map<string, number>): void {
  sessionCounters.set(sessionKey, new Map(counters));
}

export function previewAnonymization(
  text: string,
  sessionKey: string,
  dictionary: DictionaryEntry[] = []
): AnonymizationResult {
  const tempKey = `preview_${sessionKey}_${Date.now()}`;
  const existingMapping = getSessionMapping(sessionKey);
  Object.assign(getSessionMapping(tempKey), existingMapping);
  if (sessionCounters.has(sessionKey)) {
    sessionCounters.set(tempKey, new Map(sessionCounters.get(sessionKey)!));
  }
  const result = anonymize(text, tempKey, dictionary);
  clearSessionMapping(tempKey);
  return result;
}
