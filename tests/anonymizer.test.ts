import { describe, it, expect, beforeEach } from "vitest";
import { anonymize, reidentify, clearAllMappings } from "../src/core/anonymizer";

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
