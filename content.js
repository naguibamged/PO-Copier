(async () => {
  // Check if the window already exists
  if (document.getElementById("floating-window-container")) {
    return;
  }

  // Fetch the HTML for the window
  const response = await fetch(chrome.runtime.getURL("panel.html"));
  const html = await response.text();

  // Create a container and inject the HTML
  const container = document.createElement("div");
  container.id = "floating-window-container";
  container.innerHTML = html;
  document.body.appendChild(container);

  // Tell the background script that the UI is ready
  chrome.runtime.sendMessage({ action: "uiReady" });
})();
