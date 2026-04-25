import { useState } from "react";
import { type DetectedEntity } from "@/core/anonymizer";

interface Props {
  input: string;
  output: string;
  entities: DetectedEntity[];
  aiResponse: string;
  reidentified: string;
  onInputChange: (text: string) => void;
  onRunAnonymize: (text: string) => void;
  onAiResponseChange: (text: string) => void;
  onReidentifyResponse: (text: string) => void;
  onReset: () => void;
}

export default function AnonymizePanel({
  input, output, entities, aiResponse, reidentified,
  onInputChange, onRunAnonymize, onAiResponseChange, onReidentifyResponse, onReset,
}: Props) {
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedReidentified, setCopiedReidentified] = useState(false);

  const inputTooLarge = input.length > 30_000;

  const handleCopyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const handleCopyReidentified = async () => {
    await navigator.clipboard.writeText(reidentified);
    setCopiedReidentified(true);
    setTimeout(() => setCopiedReidentified(false), 1500);
  };

  return (
    <div className="panel">

      {/* ── Sektion 1: Original-Text ───────────────────────────────── */}
      <div className="section-header">1 · Eingabe</div>
      <textarea
        placeholder="Text mit sensiblen Daten hier einfügen…"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        rows={6}
        aria-label="Eingabetext zur Anonymisierung"
      />
      {inputTooLarge && (
        <p className="error-msg" role="alert">
          Text zu lang ({input.length.toLocaleString("de")} Zeichen). Max. 30.000 Zeichen.
        </p>
      )}
      <div className="btn-row">
        <button
          className="btn btn-primary"
          onClick={() => onRunAnonymize(input)}
          disabled={!input.trim() || inputTooLarge}
          aria-label="Text anonymisieren"
        >
          Anonymisieren
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          Zurücksetzen
        </button>
      </div>

      {/* ── Sektion 2: Anonymisierter Text ────────────────────────── */}
      {output && (
        <>
          <div className="section-header">2 · Anonymisierter Text</div>
          <div className="output-box" aria-live="polite">
            {output}
            <button className="btn btn-ghost copy-btn" onClick={handleCopyOutput}>
              {copiedOutput ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>

          {entities.length > 0 && (
            <>
              <div className="label">Erkannte Entitäten ({entities.length})</div>
              <div className="entity-list">
                {entities.map((e, i) => (
                  <span key={i} className="entity-badge">
                    <span className="type">{e.type}</span>
                    <span className="original">{e.original}</span>
                    <span>→ {e.placeholder}</span>
                  </span>
                ))}
              </div>
            </>
          )}

          {/* ── Sektion 3: AI-Antwort re-identifizieren ───────────── */}
          <div className="section-header">3 · AI-Antwort re-identifizieren</div>
          <p className="section-hint">
            Antwort von ChatGPT / Claude hier einfügen – Platzhalter wie{" "}
            <code>[[PERSON_1]]</code> werden durch echte Werte ersetzt.
          </p>
          <textarea
            placeholder="Antwort der KI hier einfügen…"
            value={aiResponse}
            onChange={(e) => onAiResponseChange(e.target.value)}
            rows={5}
            aria-label="AI-Antwort zur Re-Identifizierung"
          />
          <div className="btn-row">
            <button
              className="btn btn-primary"
              onClick={() => onReidentifyResponse(aiResponse)}
              disabled={!aiResponse.trim()}
              aria-label="AI-Antwort re-identifizieren"
            >
              Re-Identifizieren
            </button>
          </div>

          {reidentified && (
            <>
              <div className="label">Re-identifizierte Antwort</div>
              <div className="output-box" aria-live="polite">
                {reidentified}
                <button className="btn btn-ghost copy-btn" onClick={handleCopyReidentified}>
                  {copiedReidentified ? "Kopiert ✓" : "Kopieren"}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {!output && !input && (
        <p className="empty">
          Füge Text ein – oder klicke auf der KI-Seite auf „🔒 Anonymisieren".
        </p>
      )}
    </div>
  );
}
