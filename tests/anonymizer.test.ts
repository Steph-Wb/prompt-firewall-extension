import { describe, it, expect, beforeEach } from "vitest";
import {
  anonymize, reidentify, clearAllMappings,
  getSessionMapping, getSessionCounters,
  setSessionMapping, setSessionCounters,
} from "../src/core/anonymizer";

const KEY = "test";

beforeEach(() => {
  clearAllMappings();
});

describe("E-Mail", () => {
  it("erkennt eine einfache E-Mail", () => {
    const { anonymizedText, entities } = anonymize("Schreib an max@example.com bitte.", KEY);
    expect(anonymizedText).not.toContain("max@example.com");
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("EMAIL");
  });

  it("re-identifiziert korrekt", () => {
    const { anonymizedText } = anonymize("Kontakt: test@firma.de", KEY);
    expect(reidentify(anonymizedText, KEY)).toContain("test@firma.de");
  });
});

describe("IBAN", () => {
  it("erkennt deutsche IBAN", () => {
    const { anonymizedText, entities } = anonymize("IBAN: DE89370400440532013000", KEY);
    expect(anonymizedText).not.toContain("DE89370400440532013000");
    expect(entities[0].type).toBe("IBAN");
  });
});

describe("Telefon", () => {
  it("erkennt Telefonnummer mit Vorwahl", () => {
    const { entities } = anonymize("Ruf mich an: +49 89 123456", KEY);
    expect(entities.some((e) => e.type === "TELEFON")).toBe(true);
  });
});

describe("Datum", () => {
  it("erkennt deutsches Datumsformat", () => {
    const { anonymizedText, entities } = anonymize("Geburtsdatum: 15.03.1985", KEY);
    expect(anonymizedText).not.toContain("15.03.1985");
    expect(entities[0].type).toBe("DATUM");
  });
});

describe("Personen (NER)", () => {
  it("erkennt Namen mit Anrede", () => {
    const { anonymizedText } = anonymize("Sehr geehrter Herr Müller,", KEY);
    expect(anonymizedText).not.toContain("Müller");
  });

  it("erkennt Namen mit Titel", () => {
    const { anonymizedText } = anonymize("Rechtsanwalt Schmidt vertritt den Kläger.", KEY);
    expect(anonymizedText).not.toContain("Schmidt");
  });
});

describe("ORG", () => {
  it("erkennt GmbH", () => {
    const { anonymizedText, entities } = anonymize("Die Muster GmbH hat geklagt.", KEY);
    expect(anonymizedText).not.toContain("Muster GmbH");
    expect(entities.some((e) => e.type === "ORG")).toBe(true);
  });

  it("erkennt AG", () => {
    const { entities } = anonymize("Auftraggeber: Beispiel AG", KEY);
    expect(entities.some((e) => e.type === "ORG")).toBe(true);
  });
});

describe("Custom Dictionary", () => {
  it("anonymisiert einen benutzerdefinierten Begriff", () => {
    const { anonymizedText, entities } = anonymize("Mandant Becker GbR ist bekannt.", KEY, [
      { term: "Becker GbR", category: "MANDANT", isRegex: false },
    ]);
    expect(anonymizedText).not.toContain("Becker GbR");
    expect(entities[0].type).toBe("MANDANT");
  });

  it("anonymisiert ein Regex-Pattern", () => {
    const { anonymizedText } = anonymize("Akte AZ-2024-001 und AZ-2024-002", KEY, [
      { term: "AZ-\\d{4}-\\d{3}", category: "AKTENZEICHEN", isRegex: true },
    ]);
    expect(anonymizedText).not.toContain("AZ-2024-001");
    expect(anonymizedText).not.toContain("AZ-2024-002");
  });
});

describe("Platzhalter-Konsistenz", () => {
  it("verwendet denselben Platzhalter für identische Werte", () => {
    const { anonymizedText } = anonymize("max@test.de und noch mal max@test.de", KEY);
    const placeholders = [...anonymizedText.matchAll(/\[\[EMAIL_\d+\]\]/g)];
    expect(placeholders[0][0]).toBe(placeholders[1][0]);
  });
});

describe("Leak-Check", () => {
  it("hinterlässt keine rohen E-Mails nach der Anonymisierung", () => {
    const text = "Von: anna@kanzlei.de An: bob@gericht.de";
    const { anonymizedText } = anonymize(text, KEY);
    expect(anonymizedText).not.toMatch(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  });
});

describe("AI-Antwort Re-Identifizierung", () => {
  it("re-identifiziert Platzhalter in einer KI-Antwort korrekt", () => {
    anonymize("Mandant Max Müller (max@beispiel.de) aus Berlin.", KEY);
    // Simulate AI response that contains placeholders mixed with new text
    const aiResponse = "Für [[PERSON_1]] ([[EMAIL_1]]) aus [[ORT_1]] empfehle ich folgendes Vorgehen.";
    const result = reidentify(aiResponse, KEY);
    expect(result).toContain("Max Müller");
    expect(result).toContain("max@beispiel.de");
    expect(result).not.toContain("[[PERSON_1]]");
    expect(result).not.toContain("[[EMAIL_1]]");
  });

  it("lässt unbekannte Platzhalter unverändert", () => {
    anonymize("Frau Schmidt", KEY);
    const aiResponse = "Text mit [[PERSON_1]] und [[UNBEKANNT_99]].";
    const result = reidentify(aiResponse, KEY);
    expect(result).not.toContain("[[PERSON_1]]");
    expect(result).toContain("[[UNBEKANNT_99]]");
  });
});

describe("Mapping Serialisierung (sessionStore Roundtrip)", () => {
  it("mapping und counters überleben serialize/deserialize", () => {
    anonymize("Herr Thomas Huber, IBAN DE89370400440532013000", KEY);

    // Simulate what sessionStore.persistAll does
    const mapping = { ...getSessionMapping(KEY) };
    const counters = Object.fromEntries(getSessionCounters(KEY));

    // Clear in-memory state to simulate panel close
    clearAllMappings();

    // Simulate what sessionStore.restoreAll does
    setSessionMapping(KEY, mapping);
    setSessionCounters(KEY, new Map(Object.entries(counters)));

    // Re-identify should still work
    const aiResponse = "Bitte zahlen Sie auf [[IBAN_1]] ein, Herr [[PERSON_1]].";
    const result = reidentify(aiResponse, KEY);
    expect(result).toContain("DE89370400440532013000");
    expect(result).toContain("Thomas Huber");
  });
});
