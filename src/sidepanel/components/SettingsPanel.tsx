import { useState, useEffect } from "react";
import { getSettings, saveSettings, type Settings } from "@/core/storage";
import { useT } from "@/i18n";

export default function SettingsPanel() {
  const T = useT();
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
        <label htmlFor="lang-select">{T("settings.language.label")}</label>
        <select
          id="lang-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Settings["language"])}
        >
          <option value="de">{T("lang.de")}</option>
          <option value="en">{T("lang.en")}</option>
        </select>
      </div>

      <button className="btn btn-primary" onClick={handleSave} aria-label={T("settings.save")}>
        {saved ? T("settings.saved") : T("settings.save")}
      </button>

      <hr className="divider" />
      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {T("settings.privacy")}
      </p>
    </div>
  );
}
