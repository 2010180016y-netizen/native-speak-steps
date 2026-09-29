import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/errorReporting";

installGlobalErrorReporting();

// The service worker makes the app installable and usable offline (PLT-2) and receives study
// reminders (PRD-3). Not in development: it would cache the dev server's modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}

createRoot(document.getElementById("root")!).render(<App />);
