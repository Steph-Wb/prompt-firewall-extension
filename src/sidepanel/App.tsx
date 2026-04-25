import { useState, useEffect } from "react";
import AnonymizePanel from "./components/AnonymizePanel";
import DictionaryPanel from "./components/DictionaryPanel";
import SettingsPanel from "./components/SettingsPanel";

type Tab = "anonymize" | "dictionary" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("anonymize");

  // Auto-switch to Anonymize tab when content script sends pending text
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "session" && changes.pf_pending?.newValue) {
        setTab("anonymize");
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  return (
    <>
      <nav className="nav">
        {(["anonymize", "dictionary", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`nav-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "anonymize" && "Anonymizer"}
            {t === "dictionary" && "Wörterbuch"}
            {t === "settings" && "Einstellungen"}
          </button>
        ))}
      </nav>

      {tab === "anonymize" && <AnonymizePanel />}
      {tab === "dictionary" && <DictionaryPanel />}
      {tab === "settings" && <SettingsPanel />}
    </>
  );
}
