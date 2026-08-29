import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'   // 👈 add this

import App from './App.jsx'

// Intercept all API traffic for monitoring in the "System Load" performance dashboard
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const start = Date.now();
  let url = typeof input === "string" ? input : input?.url || "";
  let cleanPath = url;
  try {
    const parsedUrl = new URL(url, window.location.origin);
    cleanPath = parsedUrl.pathname;
  } catch (e) {
    cleanPath = url.split("?")[0];
  }

  if (url.includes("api.drinkprime.in")) {
    cleanPath = "DrinkPrime: " + cleanPath;
  } else if (url.includes("identitytoolkit.googleapis.com")) {
    cleanPath = "Firebase: SignIn";
  } else if (url.includes("firestore.googleapis.com")) {
    cleanPath = "Firestore: " + cleanPath.split("/").pop();
  }

  try {
    const response = await originalFetch(input, init);
    const duration = Date.now() - start;
    
    try {
      const raw = localStorage.getItem("pw_api_load_logs");
      const logs = raw ? JSON.parse(raw) : [];
      logs.push({
        path: cleanPath,
        duration,
        type: response.ok ? "success" : "error",
        status: response.status,
        at: new Date().toISOString()
      });
      if (logs.length > 1000) logs.shift();
      localStorage.setItem("pw_api_load_logs", JSON.stringify(logs));
    } catch {}

    return response;
  } catch (error) {
    const duration = Date.now() - start;
    
    try {
      const raw = localStorage.getItem("pw_api_load_logs");
      const logs = raw ? JSON.parse(raw) : [];
      logs.push({
        path: cleanPath,
        duration,
        type: "error",
        status: 0,
        at: new Date().toISOString()
      });
      if (logs.length > 1000) logs.shift();
      localStorage.setItem("pw_api_load_logs", JSON.stringify(logs));
    } catch {}

    throw error;
  }
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
