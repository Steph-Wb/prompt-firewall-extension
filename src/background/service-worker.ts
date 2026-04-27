chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

// Content script sends text + OPEN_WITH_TEXT → store in session storage, open panel.
// The service worker is always a trusted context and can always write to session storage.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "OPEN_WITH_TEXT" && sender.tab?.id) {
    const tabId = sender.tab.id;
    chrome.storage.session
      .set({ pf_pending: msg.text as string })
      .then(() => chrome.sidePanel.open({ tabId }));
  }
});

// Keyboard shortcut Ctrl+Shift+A: tell content script to grab textarea text, then open panel
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "anonymize_current_input") return;

  const open = (tabId: number) => {
    chrome.tabs.sendMessage(tabId, { type: "GRAB_AND_OPEN" });
    chrome.sidePanel.open({ tabId });
  };

  if (tab?.id) {
    open(tab.id);
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) open(tabs[0].id);
    });
  }
});
