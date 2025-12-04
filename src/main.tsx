import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logCacheStatus } from "./utils/offlineStorage";

createRoot(document.getElementById("root")!).render(<App />);

// Log cache status for debugging in development
if (import.meta.env.DEV) {
  setTimeout(() => {
    logCacheStatus();
  }, 2000);
}
