import { useState, useEffect } from "react";
import {
  getDictionary,
  saveDictionary,
  addDictionaryItem,
  removeDictionaryItem,
  type DictionaryItem,
} from "@/core/storage";

export default function DictionaryPanel() {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("CUSTOM");
  const [isRegex, setIsRegex] = useState(false);

  useEffect(() => {
    getDictionary().then(setItems);
  }, []);

  const handleAdd = async () => {
    if (!term.trim()) return;
    const cat = category.trim() || "CUSTOM";
    const updated = addDictionaryItem(items, { term: term.trim(), category: cat.toUpperCase(), isRegex });
    setItems(updated);
    await saveDictionary(updated);
    setTerm("");
  };

  const handleRemove = async (id: string) => {
    const updated = removeDictionaryItem(items, id);
    setItems(updated);
    await saveDictionary(updated);
  };

  return (
    <div className="panel">
      <div className="label">Neuer Eintrag</div>

      <input
        type="text"
        placeholder="Begriff oder Regex-Pattern"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Kategorie (z. B. MANDANT)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ flex: 1 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 12 }}>
          <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
          Regex
        </label>
      </div>

      <button className="btn btn-primary" onClick={handleAdd} disabled={!term.trim()}>
        Hinzufügen
      </button>

      <hr className="divider" />
      <div className="label">Einträge ({items.length})</div>

      {items.length === 0 ? (
        <p className="empty">Noch keine benutzerdefinierten Begriffe.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="dict-item">
            <span className="term">{item.term}</span>
            {item.isRegex && <span className="regex-badge">Regex</span>}
            <span className="category">{item.category}</span>
            <button className="btn btn-danger" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => handleRemove(item.id)}>
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
