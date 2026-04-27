import { useState, useEffect } from "react";
import {
  getDictionary,
  saveDictionary,
  addDictionaryItem,
  removeDictionaryItem,
  type DictionaryItem,
} from "@/core/storage";
import { useT } from "@/i18n";

function validateRegex(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as SyntaxError).message;
  }
}

export default function DictionaryPanel() {
  const T = useT();
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
      <div className="label">{T("dict.new")}</div>

      <input
        type="text"
        placeholder={T("dict.term.placeholder")}
        value={term}
        aria-label={T("dict.term.placeholder")}
        aria-invalid={regexError ? "true" : "false"}
        onChange={(e) => handleTermChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {regexError && (
        <p className="error-msg" role="alert">{T("dict.error.regex", { error: regexError })}</p>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder={T("dict.category.placeholder")}
          value={category}
          aria-label={T("dict.category.placeholder")}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={isRegex}
            aria-label={T("dict.regex.label")}
            onChange={(e) => {
              setIsRegex(e.target.checked);
              setRegexError(null);
            }}
          />
          {T("dict.regex.label")}
        </label>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleAdd}
        disabled={!term.trim()}
        aria-label={T("btn.add")}
      >
        {T("btn.add")}
      </button>

      <hr className="divider" />
      <div className="label">{T("dict.entries", { count: items.length })}</div>

      {items.length === 0 ? (
        <p className="empty">{T("dict.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <li key={item.id} className="dict-item">
              <span className="term">{item.term}</span>
              {item.isRegex && <span className="regex-badge">{T("dict.regex.label")}</span>}
              <span className="category">{item.category}</span>
              <button
                className="btn btn-danger"
                style={{ padding: "3px 8px", fontSize: 11, marginLeft: "auto" }}
                aria-label={T("dict.remove", { term: item.term })}
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
