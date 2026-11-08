import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/outfit/index.css";
import App from "./App.jsx";
import { ToastProvider } from "./components/ui.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
