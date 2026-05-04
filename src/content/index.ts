/**
 * Content script – injected into supported AI chat pages.
 *
 * Injects a floating "Anonymisieren" button (Shadow DOM, style-isolated).
 * On click (or Ctrl+Shift+A): reads the active chat textarea, stores the text
 * in chrome.storage.session['pf_pending'], and signals the service worker to
 * open the side panel. The side panel picks up the pending text and
 * auto-anonymizes it.
 */

const SITE_SELECTORS: Record<string, string> = {
  "chat.openai.com": "#prompt-textarea",
  "chatgpt.com": "#prompt-textarea",
  "claude.ai": '[data-testid="chat-input"]',
  "gemini.google.com": ".ql-editor",
  "copilot.microsoft.com": "#userInput",
};

function getTextFromElement(el: Element): string {
  if (el instanceof HTMLTextAreaElement) return el.value;
  return (el as HTMLElement).innerText || (el as HTMLElement).textContent || "";
}

async function captureAndSend(selector: string): Promise<void> {
  const el = document.querySelector(selector);
  if (!el) return;
  const text = getTextFromElement(el).trim();
  if (!text) return;
  // Send text to the service worker — it stores it in session storage (trusted context)
  // and opens the panel. Content scripts cannot reliably access chrome.storage.session.
  chrome.runtime.sendMessage({ type: "OPEN_WITH_TEXT", text });
}

function injectFab(selector: string): void {
  if (document.getElementById("pf-fab-host")) return;

  const host = document.createElement("div");
  host.id = "pf-fab-host";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      .fab {
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 2147483647;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 24px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.15s, transform 0.1s;
        user-select: none;
      }
      .fab:hover { background: #2563eb; transform: translateY(-1px); }
      .fab:active { transform: translateY(0); }
      .fab.sent { background: #16a34a; }
    </style>
    <button class="fab" title="Text in Prompt Firewall laden (Ctrl+Shift+A)">🔒 Anonymisieren</button>
  `;

  document.body.appendChild(host);

  const btn = shadow.querySelector(".fab") as HTMLButtonElement;
  btn.addEventListener("click", async () => {
    await captureAndSend(selector);
    btn.textContent = "✓ Gesendet";
    btn.classList.add("sent");
    setTimeout(() => {
      btn.textContent = "🔒 Anonymisieren";
      btn.classList.remove("sent");
    }, 1500);
  });
}

function insertTextIntoElement(el: Element, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.focus();
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // contenteditable (e.g. Gemini .ql-editor, Claude [data-testid="chat-input"])
    (el as HTMLElement).focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
    // Fallback: set innerText and fire input event
    if ((el as HTMLElement).innerText !== text) {
      (el as HTMLElement).innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
    }
  }
}

// Listen for keyboard shortcut trigger and write-back from service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "GRAB_AND_OPEN" && activeSelector) {
    captureAndSend(activeSelector);
  }

  if (msg.type === "INSERT_TEXT" && activeSelector) {
    const el = document.querySelector(activeSelector);
    if (el) insertTextIntoElement(el, msg.text as string);
  }
});

// Detect site and wait for textarea to appear
const host = location.hostname;
const entry = Object.entries(SITE_SELECTORS).find(([key]) => host.includes(key));
let activeSelector: string | null = null;

if (entry) {
  activeSelector = entry[1];
  const selector = activeSelector;

  const tryInject = () => {
    if (document.querySelector(selector)) {
      injectFab(selector);
    }
  };

  tryInject();

  // SPAs load content dynamically; observe DOM until textarea appears
  const observer = new MutationObserver(() => {
    if (document.getElementById("pf-fab-host")) {
      observer.disconnect();
      return;
    }
    tryInject();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
