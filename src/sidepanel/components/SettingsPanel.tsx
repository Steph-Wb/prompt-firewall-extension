import { useState, useEffect } from "react";
import { getSettings, saveSettings, type Settings } from "@/core/storage";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    language: "de",
    llmProvider: "none",
    apiKey: "",
    model: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="panel">
      <div className="settings-row">
        <label>Sprache der Anonymisierung</label>
        <select value={settings.language} onChange={(e) => update("language", e.target.value as Settings["language"])}>
          <option value="de">Deutsch (DACH)</option>
          <option value="en">English (coming soon)</option>
        </select>
      </div>

      <hr className="divider" />
      <div className="label">LLM-Integration (optional)</div>

      <div className="settings-row">
        <label>Anbieter</label>
        <select value={settings.llmProvider} onChange={(e) => update("llmProvider", e.target.value as Settings["llmProvider"])}>
          <option value="none">Kein (nur Anonymisierung)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>

      {settings.llmProvider !== "none" && (
        <>
          <div className="settings-row">
            <label>API-Key</label>
            <input
              type="password"
              placeholder="sk-…"
              value={settings.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
            />
          </div>
          <div className="settings-row">
            <label>Modell</label>
            <input
              type="text"
              placeholder={settings.llmProvider === "openai" ? "gpt-4o" : "claude-opus-4-7"}
              value={settings.model}
              onChange={(e) => update("model", e.target.value)}
            />
          </div>
        </>
      )}

      <button className="btn btn-primary" onClick={handleSave}>
        {saved ? "Gespeichert ✓" : "Einstellungen speichern"}
      </button>

      <hr className="divider" />
      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Alle Daten bleiben lokal in deinem Browser. Es werden keine Informationen
        an externe Server von Prompt Firewall gesendet.
      </p>
    </div>
  );
}
