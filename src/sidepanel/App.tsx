import { useState, useEffect, useRef } from "react";
import AnonymizePanel from "./components/AnonymizePanel";
import DictionaryPanel from "./components/DictionaryPanel";
import SettingsPanel from "./components/SettingsPanel";
import {
  anonymize, clearSessionMapping, reidentify,
  addToSessionMapping, removeFromSessionMapping, getSessionMapping,
  type DetectedEntity,
} from "@/core/anonymizer";
import { getDictionary, getSettings, type DictionaryItem } from "@/core/storage";
import { persistAll, restoreAll, clearAll, type WorkflowState } from "@/core/sessionStore";
import { LanguageProvider } from "@/i18n";

const SESSION_KEY = "sidepanel_session";
type Tab = "anonymize" | "dictionary" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("anonymize");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [aiResponse, setAiResponse] = useState("");
  const [reidentified, setReidentified] = useState("");
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [language, setLanguage] = useState<"de" | "en">("de");

  // Refs so storage listener always sees latest values without re-registering
  const dictionaryRef = useRef<DictionaryItem[]>([]);
  const languageRef = useRef<"de" | "en">("de");
  useEffect(() => { dictionaryRef.current = dictionary; }, [dictionary]);
  useEffect(() => { languageRef.current = language; }, [language]);

  // On mount: load dictionary + settings + restore workflow state + mapping
  useEffect(() => {
    Promise.all([
      getDictionary(),
      getSettings(),
      restoreAll(SESSION_KEY),
    ]).then(([dict, settings, workflow]) => {
      setDictionary(dict);
      dictionaryRef.current = dict;
      setLanguage(settings.language);
      languageRef.current = settings.language;
      if (workflow) {
        setInput(workflow.input);
        setOutput(workflow.output);
        setEntities(workflow.entities);
        setAiResponse(workflow.aiResponse);
        setReidentified(workflow.reidentified);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Storage listener: keep dictionary + language in sync + handle pending text
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && changes.pf_dictionary) {
        const updated = (changes.pf_dictionary.newValue ?? []) as DictionaryItem[];
        setDictionary(updated);
      }

      if (area === "local" && changes.pf_settings) {
        const updated = changes.pf_settings.newValue as { language: "de" | "en" } | undefined;
        if (updated?.language) {
          setLanguage(updated.language);
          languageRef.current = updated.language;
        }
      }

      if (area === "session" && changes.pf_pending?.newValue) {
        const pending = changes.pf_pending.newValue as string;
        chrome.storage.session.remove("pf_pending");
        setTab("anonymize");
        clearSessionMapping(SESSION_KEY);
        const result = anonymize(pending, SESSION_KEY, dictionaryRef.current, languageRef.current);
        const newState: WorkflowState = {
          input: pending,
          output: result.anonymizedText,
          entities: result.entities,
          aiResponse: "",
          reidentified: "",
        };
        setInput(newState.input);
        setOutput(newState.output);
        setEntities(newState.entities);
        setAiResponse("");
        setReidentified("");
        persistAll(SESSION_KEY, newState);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // ── Callbacks passed to AnonymizePanel ──────────────────────────────────

  const handleInputChange = (text: string) => setInput(text);

  const handleRunAnonymize = (text: string) => {
    clearSessionMapping(SESSION_KEY);
    const result = anonymize(text, SESSION_KEY, dictionaryRef.current, languageRef.current);
    setInput(text);
    setOutput(result.anonymizedText);
    setEntities(result.entities);
    setAiResponse("");
    setReidentified("");
    persistAll(SESSION_KEY, {
      input: text,
      output: result.anonymizedText,
      entities: result.entities,
      aiResponse: "",
      reidentified: "",
    });
  };

  const handleAiResponseChange = (text: string) => {
    setAiResponse(text);
    if (reidentified) setReidentified("");
  };

  const handleReidentifyResponse = (responseText: string) => {
    const result = reidentify(responseText, SESSION_KEY);
    setReidentified(result);
    persistAll(SESSION_KEY, { input, output, entities, aiResponse: responseText, reidentified: result });
  };

  const handleAddSelection = (selectedText: string) => {
    if (!selectedText.trim() || !output.includes(selectedText)) return;
    const placeholder = addToSessionMapping(SESSION_KEY, selectedText);
    const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const newOutput = output.replace(new RegExp(escaped, "g"), placeholder);
    const newEntity: DetectedEntity = {
      type: "CUSTOM",
      original: selectedText,
      placeholder,
      start: -1,
      end: -1,
    };
    const newEntities = [...entities.filter((e) => e.placeholder !== placeholder), newEntity];
    setOutput(newOutput);
    setEntities(newEntities);
    persistAll(SESSION_KEY, { input, output: newOutput, entities: newEntities, aiResponse, reidentified });
  };

  const handleUnAnonymize = (placeholder: string) => {
    const originalValue = getSessionMapping(SESSION_KEY)[placeholder];
    if (!originalValue) return;
    removeFromSessionMapping(SESSION_KEY, placeholder);
    const newOutput = output.split(placeholder).join(originalValue);
    const newEntities = entities.filter((e) => e.placeholder !== placeholder);
    setOutput(newOutput);
    setEntities(newEntities);
    persistAll(SESSION_KEY, { input, output: newOutput, entities: newEntities, aiResponse, reidentified });
  };

  const handleReset = async () => {
    clearSessionMapping(SESSION_KEY);
    setInput("");
    setOutput("");
    setEntities([]);
    setAiResponse("");
    setReidentified("");
    await clearAll();
  };

  return (
    <LanguageProvider value={language}>
      <nav className="nav">
        {(["anonymize", "dictionary", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`nav-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "anonymize" && "Anonymizer"}
            {t === "dictionary" && (language === "de" ? "Wörterbuch" : "Dictionary")}
            {t === "settings" && (language === "de" ? "Einstellungen" : "Settings")}
          </button>
        ))}
      </nav>

      {tab === "anonymize" && (
        <AnonymizePanel
          input={input}
          output={output}
          entities={entities}
          aiResponse={aiResponse}
          reidentified={reidentified}
          onInputChange={handleInputChange}
          onRunAnonymize={handleRunAnonymize}
          onAiResponseChange={handleAiResponseChange}
          onReidentifyResponse={handleReidentifyResponse}
          onAddSelection={handleAddSelection}
          onUnAnonymize={handleUnAnonymize}
          onReset={handleReset}
        />
      )}
      {tab === "dictionary" && <DictionaryPanel />}
      {tab === "settings" && <SettingsPanel />}
    </LanguageProvider>
  );
}
