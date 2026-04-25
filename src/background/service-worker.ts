// Grant content scripts access to session storage (needed for IPC)
chrome.storage.session.setAccessLevel({
  accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS,
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
  chrome.storage.session.setAccessLevel({
    accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS,
  });
});

// Content script → service worker: open side panel after storing pending text
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "OPEN_WITH_TEXT" && sender.tab?.id) {
    chrome.sidePanel.open({ tabId: sender.tab.id });
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
