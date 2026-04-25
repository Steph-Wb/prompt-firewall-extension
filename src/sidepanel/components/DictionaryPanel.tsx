import { useState, useEffect } from "react";
import {
  getDictionary,
  saveDictionary,
  addDictionaryItem,
  removeDictionaryItem,
  type DictionaryItem,
} from "@/core/storage";

function validateRegex(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as SyntaxError).message;
  }
}

export default function DictionaryPanel() {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("CUSTOM");
  const [isRegex, setIsRegex] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);

  useEffect(() => {
    getDictionary().then(setItems);
  }, []);

  const handleTermChange = (value: string) => {
    setTerm(value);
    if (regexError) setRegexError(null);
  };

  const handleAdd = async () => {
    const trimmed = term.trim();
    if (!trimmed) return;

    if (isRegex) {
      const err = validateRegex(trimmed);
      if (err) {
        setRegexError(err);
        return;
      }
    }

    const cat = category.trim() || "CUSTOM";
    const updated = addDictionaryItem(items, {
      term: trimmed,
      category: cat.toUpperCase(),
      isRegex,
    });
    setItems(updated);
    await saveDictionary(updated);
    setTerm("");
    setRegexError(null);
  };

  const handleRemove = async (id: string) => {
    const updated = removeDictionaryItem(items, id);
    setItems(updated);
    await saveDictionary(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="panel">
      <div className="label">Neuer Eintrag</div>

      <input
        type="text"
        placeholder="Begriff oder Regex-Pattern"
        value={term}
        aria-label="Begriff oder Regex-Pattern"
        aria-invalid={regexError ? "true" : "false"}
        onChange={(e) => handleTermChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {regexError && (
        <p className="error-msg" role="alert">Ungültiger Regex: {regexError}</p>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Kategorie (z. B. MANDANT)"
          value={category}
          aria-label="Kategorie"
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={isRegex}
            aria-label="Als regulären Ausdruck behandeln"
            onChange={(e) => {
              setIsRegex(e.target.checked);
              setRegexError(null);
            }}
          />
          Regex
        </label>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleAdd}
        disabled={!term.trim()}
        aria-label="Eintrag hinzufügen"
      >
        Hinzufügen
      </button>

      <hr className="divider" />
      <div className="label">Einträge ({items.length})</div>

      {items.length === 0 ? (
        <p className="empty">Noch keine benutzerdefinierten Begriffe.</p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <li key={item.id} className="dict-item">
              <span className="term">{item.term}</span>
              {item.isRegex && <span className="regex-badge">Regex</span>}
              <span className="category">{item.category}</span>
              <button
                className="btn btn-danger"
                style={{ padding: "3px 8px", fontSize: 11, marginLeft: "auto" }}
                aria-label={`${item.term} entfernen`}
                onClick={() => handleRemove(item.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
