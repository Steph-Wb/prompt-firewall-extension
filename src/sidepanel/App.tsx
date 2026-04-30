import { useState, useEffect, useRef } from "react";
import AnonymizePanel from "./components/AnonymizePanel";
import DictionaryPanel from "./components/DictionaryPanel";
import SettingsPanel from "./components/SettingsPanel";
import {
  anonymize, clearSessionMapping, reidentify,
  addToSessionMapping, removeFromSessionMapping, getSessionMapping,
  type DetectedEntity,
} from "@/core/anonymizer";
import { getDictionary, getSettings, saveDictionary, addDictionaryItem, type DictionaryItem } from "@/core/storage";
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
  const [autoAddToDict, setAutoAddToDict] = useState(false);

  // Refs so storage listener (empty-deps effect) always sees latest values
  const dictionaryRef = useRef<DictionaryItem[]>([]);
  const languageRef = useRef<"de" | "en">("de");
  const autoAddToDictRef = useRef(false);
  useEffect(() => { dictionaryRef.current = dictionary; }, [dictionary]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { autoAddToDictRef.current = autoAddToDict; }, [autoAddToDict]);

  // ── Auto-add detected entities to the persistent dictionary ───────────────
  async function autoAddEntitiesToDict(detectedEntities: DetectedEntity[]) {
    if (!autoAddToDictRef.current || detectedEntities.length === 0) return;
    const current = await getDictionary();
    let updated = [...current];
    let changed = false;
    for (const entity of detectedEntities) {
      if (!entity.original.trim()) continue;
      const exists = updated.some(
        (item) => item.term.toLowerCase() === entity.original.toLowerCase() && !item.isRegex
      );
      if (!exists) {
        updated = addDictionaryItem(updated, { term: entity.original, category: entity.type, isRegex: false });
        changed = true;
      }
    }
    if (changed) {
      setDictionary(updated);
      dictionaryRef.current = updated;
      await saveDictionary(updated);
    }
  }

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
      const aad = settings.autoAddToDict ?? false;
      setAutoAddToDict(aad);
      autoAddToDictRef.current = aad;
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

  // Storage listener: keep dictionary + language + settings in sync + handle pending text
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
        const updated = changes.pf_settings.newValue as { language: "de" | "en"; autoAddToDict?: boolean } | undefined;
        if (updated?.language) {
          setLanguage(updated.language);
          languageRef.current = updated.language;
        }
        if (updated !== undefined) {
          const val = updated.autoAddToDict ?? false;
          setAutoAddToDict(val);
          autoAddToDictRef.current = val;
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
        autoAddEntitiesToDict(result.entities);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    autoAddEntitiesToDict(result.entities);
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

  const handleAddEntityToDict = async (entity: DetectedEntity) => {
    const current = await getDictionary();
    const alreadyExists = current.some(
      (item) => item.term.toLowerCase() === entity.original.toLowerCase() && !item.isRegex
    );
    if (alreadyExists) return;
    const updated = addDictionaryItem(current, {
      term: entity.original,
      category: entity.type,
      isRegex: false,
    });
    setDictionary(updated);
    await saveDictionary(updated);
  };

  const handleSendToChat = () => {
    if (!output) return;
    chrome.runtime.sendMessage({ type: "WRITE_TO_CHAT", text: output });
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
          onSendToChat={handleSendToChat}
          onAddEntityToDict={handleAddEntityToDict}
        />
      )}
      {tab === "dictionary" && <DictionaryPanel />}
      {tab === "settings" && <SettingsPanel />}
    </LanguageProvider>
  );
}
