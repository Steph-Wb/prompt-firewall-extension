# Prompt Firewall

> Chrome Extension – anonymisiert sensible Daten in KI-Prompts, bevor sie den Browser verlassen.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](manifest.json)

---

## Was ist Prompt Firewall?

Wer KI-Tools wie ChatGPT, Claude oder Gemini beruflich nutzt, gibt dabei unwissentlich sensible Daten preis: Klarnamen von Mandanten, IBANs, E-Mail-Adressen, Steuernummern, Adressen.

**Prompt Firewall** setzt sich als Schutzschicht davor. Es erkennt personenbezogene Daten automatisch, ersetzt sie durch neutrale Platzhalter (`[[PERSON_1]]`, `[[IBAN_1]]` …) und stellt den Originaltext nach dem LLM-Aufruf wieder her — vollständig lokal, ohne Server, ohne Cloud.

```
Eingabe:  „Mandant Klaus Müller, IBAN DE89 3704 0044 0532 0130 00, geb. 15.03.1965"
→ LLM:    „Mandant [[PERSON_1]], IBAN [[IBAN_1]], geb. [[DATUM_1]]"
← Ausgabe: Antwort des LLM mit wiederhergestellten Originaldaten
```

---

## Features

| Erkennungsschicht | Was wird erkannt |
|---|---|
| Regex (Schicht 1) | E-Mail, IBAN, Telefon, Datum, PLZ, Steuernummer, AHV, Kreditkarte, BIC, Ausweisnummer, Kundennummer, Sozialversicherungsnummer (DE/AT), Firmenname mit Rechtsform (GmbH, AG, KG …) |
| NER-Simulation (Schicht 2) | Personen mit Anrede (Herr/Frau/Mandant/Kläger …), Orte, Organisationen mit Kontextbegriff |
| Vornamen-Liste (Schicht 2b) | Standalone-Vornamen ohne expliziten Kontext, optional mit Nachname |
| Custom Dictionary (Schicht 0) | Eigene Begriffe und Regex-Patterns, persistent in `chrome.storage` |

**Unterstützte KI-Tools** (Content Script aktiv):
- ChatGPT (`chat.openai.com`, `chatgpt.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- Microsoft Copilot (`copilot.microsoft.com`)

---

## Datenschutz

- Kein Server, keine Cloud, keine Telemetrie
- Alle Daten bleiben im Browser (`chrome.storage.local`)
- Das Platzhalter-Mapping lebt nur im RAM und wird nie persistiert
- Open Source — der Code ist vollständig einsehbar und prüfbar

---

## Installation (Entwickler)

```bash
git clone https://github.com/Steph-Wb/prompt-firewall-extension.git
cd prompt-firewall-extension
npm install
npm run build
```

Dann in Chrome:
1. `chrome://extensions` öffnen
2. **Entwicklermodus** aktivieren
3. **„Entpackte Erweiterung laden"** → `dist/` Ordner wählen

### Entwicklung mit Hot Reload

```bash
npm run dev
```

### Tests

```bash
npm test
```

---

## Projektstruktur

```
src/
├── background/
│   └── service-worker.ts     # Öffnet Side Panel bei Icon-Klick
├── content/
│   └── index.ts              # Injiziert in bekannte KI-Chat-Seiten
├── core/
│   ├── anonymizer.ts         # Anonymisierungs-Engine (3 Schichten)
│   └── storage.ts            # chrome.storage.local Wrapper
├── data/
│   └── german-first-names.json
├── sidepanel/                # Haupt-UI (React)
│   ├── App.tsx               # Tab-Navigation
│   └── components/
│       ├── AnonymizePanel.tsx
│       ├── DictionaryPanel.tsx
│       └── SettingsPanel.tsx
└── popup/                    # Minimaler Popup → öffnet Side Panel
```

---

## Mitwirken

Pull Requests sind willkommen. Besonders gesucht:

- [ ] Englischsprachige Erkennungsmuster (Namen, Adressen, SSN …)
- [ ] Französische / italienische Patterns (für CH-Mehrsprachigkeit)
- [ ] Verbesserte Ortsname-Erkennung (schweizweites Ortsverzeichnis)
- [ ] One-Click „In ChatGPT einfügen" via Content Script

Bitte öffne zuerst ein Issue, um größere Änderungen abzustimmen.

---

## Lizenz

[MIT](LICENSE) © 2026 Steph-Wb

