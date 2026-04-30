// chrome.storage.local wrappers

export interface Settings {
  language: "de" | "en";
  autoAddToDict: boolean;
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
  autoAddToDict: false,
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
  return [...items, { ...item, id: crypto.randomUUID() }];
}

export function removeDictionaryItem(
  items: DictionaryItem[],
  id: string
): DictionaryItem[] {
  return items.filter((i) => i.id !== id);
}
