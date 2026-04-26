import { useState, useRef } from "react";
import { type DetectedEntity } from "@/core/anonymizer";

// Regex that matches any [[TYPE_N]] placeholder
const PLACEHOLDER_RE = /(\[\[[^\]]+\]\])/;

/** Splits output text into alternating text / placeholder segments. */
function parseOutput(text: string): Array<{ kind: "text" | "ph"; content: string }> {
  return text.split(PLACEHOLDER_RE).map((part) => ({
    kind: PLACEHOLDER_RE.test(part) ? "ph" : "text",
    content: part,
  }));
}

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
  onAddSelection: (text: string) => void;
  onUnAnonymize: (placeholder: string) => void;
  onReset: () => void;
}

export default function AnonymizePanel({
  input, output, entities, aiResponse, reidentified,
  onInputChange, onRunAnonymize, onAiResponseChange,
  onReidentifyResponse, onAddSelection, onUnAnonymize, onReset,
}: Props) {
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedReidentified, setCopiedReidentified] = useState(false);
  // Text the user has selected inside the output box
  const [textSelection, setTextSelection] = useState<string | null>(null);
  // Placeholder currently "focused" (clicked) for un-anonymization
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputTooLarge = input.length > 30_000;

  // ── Output box interactions ────────────────────────────────────────────────

  const handleOutputMouseUp = () => {
    // If a placeholder is active, clicking plain text deselects it
    setActivePlaceholder(null);

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !outputRef.current) {
      setTextSelection(null);
      return;
    }
    // Only accept selection fully inside the output box
    if (
      !outputRef.current.contains(sel.anchorNode) ||
      !outputRef.current.contains(sel.focusNode)
    ) {
      setTextSelection(null);
      return;
    }
    const text = sel.toString().trim();
    // Reject empty or selections that span into a placeholder pattern
    if (!text || /\[\[/.test(text)) {
      setTextSelection(null);
      return;
    }
    setTextSelection(text);
  };

  const handlePlaceholderClick = (ph: string) => {
    window.getSelection()?.removeAllRanges();
    setTextSelection(null);
    setActivePlaceholder((prev) => (prev === ph ? null : ph));
  };

  const handleAddSelectionClick = () => {
    if (!textSelection) return;
    onAddSelection(textSelection);
    window.getSelection()?.removeAllRanges();
    setTextSelection(null);
  };

  const handleUnAnonymizeClick = () => {
    if (!activePlaceholder) return;
    onUnAnonymize(activePlaceholder);
    setActivePlaceholder(null);
  };

  // ── Copy helpers ───────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="panel">

      {/* ── Sektion 1: Eingabe ───────────────────────────────────────── */}
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
        >
          Anonymisieren
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          Zurücksetzen
        </button>
      </div>

      {/* ── Sektion 2: Anonymisierter Text ──────────────────────────── */}
      {output && (
        <>
          <div className="section-header">2 · Anonymisierter Text</div>
          <p className="section-hint">
            Wörter <strong>markieren</strong> → anonymisieren · Platzhalter <strong>anklicken</strong> → aufheben
          </p>

          {/* Contextual action bar — shown only when something is selected/active */}
          {(textSelection || activePlaceholder) && (
            <div className="selection-bar">
              {textSelection && (
                <>
                  <span className="selected-text">„{textSelection}"</span>
                  <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={handleAddSelectionClick}>
                    Anonymisieren
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => { window.getSelection()?.removeAllRanges(); setTextSelection(null); }}>
                    ✕
                  </button>
                </>
              )}
              {activePlaceholder && (
                <>
                  <span className="selected-text">{activePlaceholder}</span>
                  <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={handleUnAnonymizeClick}>
                    Un-Anonymisieren
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setActivePlaceholder(null)}>
                    ✕
                  </button>
                </>
              )}
            </div>
          )}

          <div
            ref={outputRef}
            className="output-box interactive"
            onMouseUp={handleOutputMouseUp}
            aria-live="polite"
          >
            {parseOutput(output).map((seg, i) =>
              seg.kind === "ph" ? (
                <button
                  key={i}
                  className={`placeholder-tag${activePlaceholder === seg.content ? " active" : ""}`}
                  onClick={() => handlePlaceholderClick(seg.content)}
                  title="Klicken zum Un-Anonymisieren"
                >
                  {seg.content}
                </button>
              ) : (
                <span key={i}>{seg.content}</span>
              )
            )}
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

          {/* ── Sektion 3: AI-Antwort re-identifizieren ─────────────── */}
          <div className="section-header">3 · AI-Antwort re-identifizieren</div>
          <p className="section-hint">
            Antwort von ChatGPT / Claude einfügen – <code>[[PERSON_1]]</code> wird durch echte Werte ersetzt.
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
