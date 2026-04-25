import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

function Popup() {
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo">🛡</span>
        <h1>Prompt Firewall</h1>
      </div>
      <p>Anonymisiert sensible Daten vor dem Senden an KI-Tools.</p>
      <button onClick={openSidePanel}>Side Panel öffnen</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
