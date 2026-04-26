import { useState, useEffect, useRef } from "react";
import AnonymizePanel from "./components/AnonymizePanel";
import DictionaryPanel from "./components/DictionaryPanel";
import SettingsPanel from "./components/SettingsPanel";
import {
  anonymize, clearSessionMapping, reidentify,
  addToSessionMapping, removeFromSessionMapping, getSessionMapping,
  type DetectedEntity,
} from "@/core/anonymizer";
import { getDictionary, type DictionaryItem } from "@/core/storage";
import { persistAll, restoreAll, clearAll, type WorkflowState } from "@/core/sessionStore";

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

  // Ref so storage listener always sees latest dictionary without re-registering
  const dictionaryRef = useRef<DictionaryItem[]>([]);
  useEffect(() => { dictionaryRef.current = dictionary; }, [dictionary]);

  // On mount: load dictionary + restore workflow state + mapping from session storage
  useEffect(() => {
    Promise.all([
      getDictionary(),
      restoreAll(SESSION_KEY),
    ]).then(([dict, workflow]) => {
      setDictionary(dict);
      dictionaryRef.current = dict;
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

  // Storage listener: keep dictionary in sync + handle FAB/shortcut pending text
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && changes.pf_dictionary) {
        const updated = (changes.pf_dictionary.newValue ?? []) as DictionaryItem[];
        setDictionary(updated);
      }

      if (area === "session" && changes.pf_pending?.newValue) {
        const pending = changes.pf_pending.newValue as string;
        chrome.storage.session.remove("pf_pending");
        setTab("anonymize");
        clearSessionMapping(SESSION_KEY);
        const result = anonymize(pending, SESSION_KEY, dictionaryRef.current);
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
    const result = anonymize(text, SESSION_KEY, dictionaryRef.current);
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

  // User selects text in the output box → immediately replace with a new placeholder
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

  // User clicks a placeholder in the output box → restore original value and remove from mapping
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
    </>
  );
}
