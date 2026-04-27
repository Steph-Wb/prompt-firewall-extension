import {
  getSessionMapping,
  getSessionCounters,
  setSessionMapping,
  setSessionCounters,
  type SessionMapping,
  type DetectedEntity,
} from "./anonymizer";

const STORAGE_KEY = "pf_session";

export interface WorkflowState {
  input: string;
  output: string;
  entities: DetectedEntity[];
  aiResponse: string;
  reidentified: string;
}

interface PersistedSession {
  mapping: SessionMapping;
  counters: Record<string, number>;
  workflow: WorkflowState;
}

export async function persistAll(
  sessionKey: string,
  workflow: WorkflowState
): Promise<void> {
  const data: PersistedSession = {
    mapping: { ...getSessionMapping(sessionKey) },
    counters: Object.fromEntries(getSessionCounters(sessionKey)),
    workflow,
  };
  await chrome.storage.session.set({ [STORAGE_KEY]: data });
}

export async function restoreAll(sessionKey: string): Promise<WorkflowState | null> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] as PersistedSession | undefined;
  if (!data) return null;
  setSessionMapping(sessionKey, data.mapping);
  setSessionCounters(sessionKey, new Map(Object.entries(data.counters)));
  return data.workflow;
}

export async function clearAll(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY);
}
