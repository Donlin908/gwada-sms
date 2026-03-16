import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
  console.log("[Sentry] Frontend monitoring initialized");
} else {
  console.warn("[Sentry] Warning: VITE_SENTRY_DSN is not set. Error reporting is disabled.");
}

createRoot(document.getElementById("root")!).render(<App />);
