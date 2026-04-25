/**
 * Content script – injected into known AI chat pages.
 *
 * Currently signals readiness to the side panel via postMessage.
 * Future: intercept textarea submit to auto-anonymize in place.
 */

const SITE_SELECTORS: Record<string, string> = {
  "chat.openai.com": "#prompt-textarea",
  "chatgpt.com": "#prompt-textarea",
  "claude.ai": '[data-testid="chat-input"]',
  "gemini.google.com": ".ql-editor",
  "copilot.microsoft.com": "#userInput",
};

const host = location.hostname;
const selector = Object.entries(SITE_SELECTORS).find(([key]) =>
  host.includes(key)
)?.[1];

if (selector) {
  // Notify the side panel that a supported AI chat is active
  window.postMessage({ type: "PROMPT_FIREWALL_READY", host }, "*");
}
