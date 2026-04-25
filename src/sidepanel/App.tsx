import { useState } from "react";
import AnonymizePanel from "./components/AnonymizePanel";
import DictionaryPanel from "./components/DictionaryPanel";
import SettingsPanel from "./components/SettingsPanel";

type Tab = "anonymize" | "dictionary" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("anonymize");

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
