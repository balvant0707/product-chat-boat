(() => {
  if (window.__pcbWidgetLoaderInitialized) {
    return;
  }
  window.__pcbWidgetLoaderInitialized = true;

  const currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) {
    return;
  }

  const runtimeSrc = new URL("chat-widget-runtime.js", currentScript.src).toString();
  if (document.querySelector(`script[src="${runtimeSrc}"]`)) {
    return;
  }

  const runtimeScript = document.createElement("script");
  runtimeScript.src = runtimeSrc;
  runtimeScript.defer = true;
  runtimeScript.setAttribute("data-pcb-runtime", "true");
  document.head.appendChild(runtimeScript);
})();
