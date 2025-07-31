// This listener waits for the message from content.js on first-time setup
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "uiReady") {
    const tabId = sender.tab.id;
    if (tabId) {
      chrome.scripting.insertCSS({ target: { tabId }, files: ["panel.css"] });
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["window.js"],
      });
    }
  }
});

// This listener handles all clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // Check if the panel already exists on the page
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => !!document.getElementById("floating-window"),
    },
    (injectionResults) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }

      const panelExists = injectionResults[0].result;

      if (panelExists) {
        // If it exists, inject a small script to toggle its visibility
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const panel = document.getElementById("floating-window");
            // Toggle between 'block' and 'none'
            panel.style.display =
              panel.style.display === "none" ? "block" : "none";
          },
        });
      } else {
        // If it doesn't exist, start the one-time creation process
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
      }
    }
  );
});
