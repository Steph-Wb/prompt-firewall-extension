import { useState, useEffect } from "react";
import { anonymize, reidentify, clearSessionMapping, type DetectedEntity } from "@/core/anonymizer";
import { getDictionary, type DictionaryItem } from "@/core/storage";

const SESSION_KEY = "sidepanel_session";

export default function AnonymizePanel() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDictionary().then(setDictionary);
  }, []);

  const handleAnonymize = () => {
    if (!input.trim()) return;
    clearSessionMapping(SESSION_KEY);
    const result = anonymize(input, SESSION_KEY, dictionary);
    setOutput(result.anonymizedText);
    setEntities(result.entities);
  };

  const handleReidentify = () => {
    if (!output) return;
    setOutput(reidentify(output, SESSION_KEY));
    setEntities([]);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReset = () => {
    setInput("");
    setOutput("");
    setEntities([]);
    clearSessionMapping(SESSION_KEY);
  };

  return (
    <div className="panel">
      <div className="label">Eingabe</div>
      <textarea
        placeholder="Text mit sensiblen Daten hier einfügen…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={7}
      />

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleAnonymize} disabled={!input.trim()}>
          Anonymisieren
        </button>
        <button className="btn btn-ghost" onClick={handleReset}>
          Zurücksetzen
        </button>
      </div>

      {output && (
        <>
          <hr className="divider" />
          <div className="label">Anonymisierter Text</div>
          <div className="output-box">
            {output}
            <button className="btn btn-ghost copy-btn" onClick={handleCopy}>
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>

          <div className="btn-row">
            <button className="btn btn-ghost" onClick={handleReidentify}>
              Re-Identifizieren
            </button>
          </div>
        </>
      )}

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

      {!output && !input && (
        <p className="empty">Füge Text ein und klicke auf „Anonymisieren".</p>
      )}
    </div>
  );
}
