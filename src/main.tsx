import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/errorReporting";

installGlobalErrorReporting();

// The service worker makes the app installable (PLT-2) and receives study reminders (PRD-3).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}

createRoot(document.getElementById("root")!).render(<App />);
