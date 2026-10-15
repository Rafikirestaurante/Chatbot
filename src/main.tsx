try { window.localStorage.removeItem("rafiki.gemini.apiKey"); } catch { /* Storage may be disabled. */ }
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles.css";

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("rafiki-update-available"));
  },
  onOfflineReady() {
    console.info("Rafiki está listo para funcionar sin conexión.");
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
