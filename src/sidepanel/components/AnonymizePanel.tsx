import { useState, useEffect, useCallback } from "react";
import { anonymize, reidentify, clearSessionMapping, type DetectedEntity } from "@/core/anonymizer";
import { getDictionary, type DictionaryItem } from "@/core/storage";

const SESSION_KEY = "sidepanel_session";

export default function AnonymizePanel() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isReidentified, setIsReidentified] = useState(false);

  const runAnonymize = useCallback((text: string, dict: DictionaryItem[]) => {
    clearSessionMapping(SESSION_KEY);
    const result = anonymize(text, SESSION_KEY, dict);
    setInput(text);
    setOutput(result.anonymizedText);
    setEntities(result.entities);
    setIsReidentified(false);
  }, []);

  // On mount: load dictionary + check for pending text from content script
  useEffect(() => {
    Promise.all([
      getDictionary(),
      chrome.storage.session.get("pf_pending"),
    ]).then(([dict, stored]) => {
      setDictionary(dict);
      const pending = stored.pf_pending as string | undefined;
      if (pending) {
        chrome.storage.session.remove("pf_pending");
        runAnonymize(pending, dict);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While panel is open: react to new pending text (e.g. user clicks FAB again)
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "session" && changes.pf_pending?.newValue) {
        const pending = changes.pf_pending.newValue as string;
        chrome.storage.session.remove("pf_pending");
        runAnonymize(pending, dictionary);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [dictionary, runAnonymize]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (entities.length > 0) setEntities([]);
  };

  const handleAnonymize = () => {
    if (!input.trim()) return;
    runAnonymize(input, dictionary);
  };

  const handleReidentify = () => {
    if (!output || isReidentified) return;
    setOutput(reidentify(output, SESSION_KEY));
    setEntities([]);
    setIsReidentified(true);
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
    setIsReidentified(false);
    clearSessionMapping(SESSION_KEY);
  };

  return (
    <div className="panel">
      <div className="label">Eingabe</div>
      <textarea
        placeholder="Text mit sensiblen Daten hier einfügen…"
        value={input}
        onChange={handleInputChange}
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
            <button className="btn btn-ghost" onClick={handleReidentify} disabled={isReidentified}>
              {isReidentified ? "Re-Identifiziert ✓" : "Re-Identifizieren"}
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
        <p className="empty">Füge Text ein – oder klicke auf der KI-Seite auf „🔒 Anonymisieren".</p>
      )}
    </div>
  );
}
