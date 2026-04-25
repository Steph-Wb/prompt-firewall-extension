import { useState, useEffect } from "react";
import { getSettings, saveSettings, type Settings } from "@/core/storage";

export default function SettingsPanel() {
  const [language, setLanguage] = useState<Settings["language"]>("de");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setLanguage(s.language));
  }, []);

  const handleSave = async () => {
    await saveSettings({ language });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="panel">
      <div className="settings-row">
        <label htmlFor="lang-select">Sprache der Anonymisierung</label>
        <select
          id="lang-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Settings["language"])}
        >
          <option value="de">Deutsch (DACH)</option>
          <option value="en">English (coming soon)</option>
        </select>
      </div>

      <button className="btn btn-primary" onClick={handleSave} aria-label="Einstellungen speichern">
        {saved ? "Gespeichert ✓" : "Einstellungen speichern"}
      </button>

      <hr className="divider" />
      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Alle Daten bleiben lokal in deinem Browser. Es werden keine Informationen
        an externe Server gesendet.
      </p>
    </div>
  );
}
