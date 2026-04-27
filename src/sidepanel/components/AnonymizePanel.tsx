import { useState, useRef } from "react";
import { type DetectedEntity } from "@/core/anonymizer";
import { useT } from "@/i18n";

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
  const T = useT();
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedReidentified, setCopiedReidentified] = useState(false);
  const [textSelection, setTextSelection] = useState<string | null>(null);
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputTooLarge = input.length > 30_000;

  // ── Output box interactions ────────────────────────────────────────────────

  const handleOutputMouseUp = () => {
    setActivePlaceholder(null);

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !outputRef.current) {
      setTextSelection(null);
      return;
    }
    if (
      !outputRef.current.contains(sel.anchorNode) ||
      !outputRef.current.contains(sel.focusNode)
    ) {
      setTextSelection(null);
      return;
    }
    const text = sel.toString().trim();
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

      {/* ── Section 1: Input ─────────────────────────────────────────────── */}
      <div className="section-header">{T("sec.input")}</div>
      <textarea
        placeholder={T("input.placeholder")}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        rows={6}
        aria-label={T("input.placeholder")}
      />
      {inputTooLarge && (
        <p className="error-msg" role="alert">
          {T("input.toolarge", { count: input.length })}
        </p>
      )}
      <div className="btn-row">
        <button
          className="btn btn-primary"
          onClick={() => onRunAnonymize(input)}
          disabled={!input.trim() || inputTooLarge}
        >
          {T("btn.anonymize")}
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          {T("btn.reset")}
        </button>
      </div>

      {/* ── Section 2: Anonymized output ─────────────────────────────────── */}
      {output && (
        <>
          <div className="section-header">{T("sec.output")}</div>
          <p className="section-hint">{T("hint.interactive")}</p>

          {(textSelection || activePlaceholder) && (
            <div className="selection-bar">
              {textSelection && (
                <>
                  <span className="selected-text">„{textSelection}"</span>
                  <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={handleAddSelectionClick}>
                    {T("selection.anonymize")}
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
                    {T("selection.unanonymize")}
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
                  title={T("selection.unanonymize")}
                >
                  {seg.content}
                </button>
              ) : (
                <span key={i}>{seg.content}</span>
              )
            )}
            <button className="btn btn-ghost copy-btn" onClick={handleCopyOutput}>
              {copiedOutput ? T("btn.copied") : T("btn.copy")}
            </button>
          </div>

          {entities.length > 0 && (
            <>
              <div className="label">{T("label.entities", { count: entities.length })}</div>
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

          {/* ── Section 3: Re-identify AI response ───────────────────────── */}
          <div className="section-header">{T("sec.reidentify")}</div>
          <p className="section-hint">{T("hint.reidentify")}</p>
          <textarea
            placeholder={T("ai.placeholder")}
            value={aiResponse}
            onChange={(e) => onAiResponseChange(e.target.value)}
            rows={5}
            aria-label={T("ai.placeholder")}
          />
          <div className="btn-row">
            <button
              className="btn btn-primary"
              onClick={() => onReidentifyResponse(aiResponse)}
              disabled={!aiResponse.trim()}
            >
              {T("btn.reidentify")}
            </button>
          </div>

          {reidentified && (
            <>
              <div className="label">{T("label.reidentified")}</div>
              <div className="output-box" aria-live="polite">
                {reidentified}
                <button className="btn btn-ghost copy-btn" onClick={handleCopyReidentified}>
                  {copiedReidentified ? T("btn.copied") : T("btn.copy")}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {!output && !input && (
        <p className="empty">{T("empty.hint")}</p>
      )}
    </div>
  );
}
