// chrome.storage.local wrappers – replaces the DB layer from the web-app MVP

export interface Settings {
  language: "de" | "en";
  llmProvider: "openai" | "anthropic" | "none";
  apiKey: string;
  model: string;
}

export interface DictionaryItem {
  id: string;
  term: string;
  category: string;
  isRegex: boolean;
  label?: string;
}

const KEYS = {
  settings: "pf_settings",
  dictionary: "pf_dictionary",
} as const;

const DEFAULT_SETTINGS: Settings = {
  language: "de",
  llmProvider: "none",
  apiKey: "",
  model: "",
};

function get<T>(key: string, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? fallback);
    });
  });
}

function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export const getSettings = (): Promise<Settings> =>
  get(KEYS.settings, DEFAULT_SETTINGS);

export const saveSettings = (s: Settings): Promise<void> =>
  set(KEYS.settings, s);

export const getDictionary = (): Promise<DictionaryItem[]> =>
  get(KEYS.dictionary, []);

export const saveDictionary = (items: DictionaryItem[]): Promise<void> =>
  set(KEYS.dictionary, items);

export function addDictionaryItem(
  items: DictionaryItem[],
  item: Omit<DictionaryItem, "id">
): DictionaryItem[] {
  const newItem: DictionaryItem = { ...item, id: crypto.randomUUID() };
  return [...items, newItem];
}

export function removeDictionaryItem(
  items: DictionaryItem[],
  id: string
): DictionaryItem[] {
  return items.filter((i) => i.id !== id);
}
