import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapApp } from "@/app/bootstrap";
import { logCacheStatus } from "@/core/system/persistence/offline-storage.ts";

bootstrapApp();

console.log("main.tsx: Starting application render...");

try {
  const rootElement = document.getElementById("root");
  console.log("main.tsx: Root element found:", !!rootElement);

  if (rootElement) {
    createRoot(rootElement).render(<App />);
    console.log("main.tsx: App rendered successfully");
  } else {
    console.error("main.tsx: Root element not found!");
  }
} catch (error) {
  console.error("main.tsx: Error during render:", error);
}

// Log cache status for debugging in development
if (import.meta.env.DEV) {
  // Remove any dev service worker left over from a previous session: it keeps
  // taking control and reloading the page, which throws away unsaved work.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }

  setTimeout(() => {
    logCacheStatus();
  }, 2000);
}
